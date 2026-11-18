import { headers } from "next/headers";
import { getIdentity } from "../../cursor/identity.js";

export type Editor = {
  email: string;
  name: string;
  stage: "production" | "preview";
  simulated: boolean;
};

export async function editorIdentity(): Promise<Editor | null> {
  const identity = await getIdentity(await headers());
  if (!identity || identity.verified !== true || identity.kind !== "person") return null;
  const allow = (process.env.EDITOR_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length > 0 && !allow.includes(String(identity.email ?? "").toLowerCase())) return null;
  const stage = identity.stage === "preview" ? "preview" : "production";
  return {
    email: String(identity.email ?? ""),
    name: String(identity.name ?? ""),
    stage,
    simulated: identity.simulated === true,
  };
}

export async function assertEditor(): Promise<Editor | { error: string }> {
  const editor = await editorIdentity();
  if (!editor) return { error: "You need to be signed in to change the archive." };
  if (editor.stage === "preview") return { error: "Preview is read-only, so this session cannot change the archive." };
  return editor;
}

export function isEditor(value: Editor | { error: string }): value is Editor {
  return !("error" in value);
}
