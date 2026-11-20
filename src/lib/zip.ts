import type { Readable } from "node:stream";
import yauzl from "yauzl";
import { isAllowlistedEntry } from "./zip-allowlist";

export { isAllowlistedEntry } from "./zip-allowlist";

export const ZIP_LIMITS = {
  maxEntryBytes: 8 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  maxEntriesRead: 40,
};

export type ZipLimits = typeof ZIP_LIMITS;

export function isSafeZipPath(name: string): boolean {
  if (!name || name.includes("\0")) return false;
  const norm = name.replace(/\\/g, "/");
  if (norm.startsWith("/") || /^[A-Za-z]:/.test(norm)) return false;
  const parts = norm.split("/");
  if (parts.some((part) => part === ".." || part === ".")) return false;
  if (norm.endsWith("/")) return parts.slice(0, -1).every((part) => part.length > 0);
  return parts.every((part) => part.length > 0);
}

export function isSymlinkMode(externalAttributes: number): boolean {
  const mode = (externalAttributes >>> 16) & 0o170000;
  return mode === 0o120000;
}

export type ZipEntry = { name: string; text: string };

export const ZIP_UPLOAD_BYTES = 100 * 1024 * 1024;

export const UPLOAD_ZIP_LIMITS: ZipLimits = {
  maxEntryBytes: 32 * 1024 * 1024,
  maxTotalBytes: 48 * 1024 * 1024,
  maxEntriesRead: 40,
};

type ZipSource = {
  close(): void;
  readEntry(): void;
  openReadStream(
    entry: { uncompressedSize: number },
    callback: (error: Error | null, stream: Readable | undefined) => void,
  ): void;
  on(event: "error", listener: (error: Error) => void): void;
  on(event: "entry", listener: (entry: { fileName: string; uncompressedSize: number; externalFileAttributes: number }) => void): void;
  on(event: "end", listener: () => void): void;
};

export function readAllowlistedZip(zipPath: string, limits: ZipLimits = ZIP_LIMITS): Promise<{ entries: ZipEntry[]; ignored: number }> {
  return openZip(
    (done) =>
      yauzl.open(
        zipPath,
        { lazyEntries: true, autoClose: false, validateEntrySizes: true, strictFileNames: false, decodeStrings: true },
        (error, zip) => done(error ?? null, zip as ZipSource | undefined),
      ),
    limits,
  );
}

export function readAllowlistedZipBuffer(zip: Buffer, limits: ZipLimits = UPLOAD_ZIP_LIMITS): Promise<{ entries: ZipEntry[]; ignored: number }> {
  return openZip(
    (done) =>
      yauzl.fromBuffer(
        zip,
        { lazyEntries: true, validateEntrySizes: true, strictFileNames: false, decodeStrings: true },
        (error, opened) => done(error ?? null, opened as ZipSource | undefined),
      ),
    limits,
  );
}

function openZip(
  open: (done: (error: Error | null, zip: ZipSource | undefined) => void) => void,
  limits: ZipLimits,
): Promise<{ entries: ZipEntry[]; ignored: number }> {
  return new Promise((resolve, reject) => {
    open((error, zip) => {
      if (error || !zip) {
        reject(error ?? new Error("Could not open ZIP"));
        return;
      }
      const entries: ZipEntry[] = [];
      let ignored = 0;
      let total = 0;
      let settled = false;
      const finish = (outcome: () => void) => {
        if (settled) return;
        settled = true;
        zip.close();
        outcome();
      };
      const fail = (reason: Error) => finish(() => reject(reason));
      zip.on("error", (err) => {
        const message = err instanceof Error ? err.message : "";
        if (/invalid relative path|absolute path|invalid characters/i.test(message)) {
          fail(new Error("Rejected an unsafe ZIP entry"));
          return;
        }
        fail(err instanceof Error ? err : new Error("Could not read ZIP"));
      });
      zip.on("entry", (entry) => {
        const name = entry.fileName.replace(/\\/g, "/");
        if (!isSafeZipPath(name) || isSymlinkMode(entry.externalFileAttributes)) {
          fail(new Error("Rejected an unsafe ZIP entry"));
          return;
        }
        if (name.endsWith("/") || !isAllowlistedEntry(name)) {
          if (!name.endsWith("/")) ignored += 1;
          zip.readEntry();
          return;
        }
        if (entries.length >= limits.maxEntriesRead || entry.uncompressedSize > limits.maxEntryBytes) {
          fail(new Error("ZIP entry exceeds the size limit"));
          return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            fail(streamError instanceof Error ? streamError : new Error("Could not read ZIP entry"));
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          stream.on("data", (chunk: Buffer | string) => {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buf.length;
            if (size > limits.maxEntryBytes || total + size > limits.maxTotalBytes) {
              stream.destroy();
              fail(new Error("ZIP entry exceeds the size limit"));
              return;
            }
            chunks.push(buf);
          });
          stream.on("end", () => {
            total += size;
            entries.push({ name, text: Buffer.concat(chunks).toString("utf8") });
            zip.readEntry();
          });
          stream.on("error", (err) => fail(err instanceof Error ? err : new Error("Could not read ZIP entry")));
        });
      });
      zip.on("end", () => finish(() => resolve({ entries, ignored })));
      zip.readEntry();
    });
  });
}
