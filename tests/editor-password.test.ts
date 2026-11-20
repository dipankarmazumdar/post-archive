import { afterEach, describe, expect, it } from "vitest";
import { editorPasswordMatches } from "../src/lib/editor-password";

describe("editor password", () => {
  const previous = process.env.EDITOR_PASSWORD;
  afterEach(() => {
    if (previous === undefined) delete process.env.EDITOR_PASSWORD;
    else process.env.EDITOR_PASSWORD = previous;
  });

  it("accepts only the configured password", () => {
    process.env.EDITOR_PASSWORD = "correct horse";
    expect(editorPasswordMatches("correct horse")).toBe(true);
    expect(editorPasswordMatches("wrong horse")).toBe(false);
    expect(editorPasswordMatches("")).toBe(false);
  });

  it("stays closed when no password is configured", () => {
    delete process.env.EDITOR_PASSWORD;
    expect(editorPasswordMatches("correct horse")).toBe(false);
  });
});
