import { createHash } from "node:crypto";
import { readFile, readdir, readlink, realpath } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { contains } from "../../shared/src/project-root.js";

import { assetState } from "./assets.js";

export interface WatchInput {
  path: string;
  kind: "file" | "tree" | "assets";
  state: string;
}
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const code = (error: unknown) =>
  (error as { code?: string }).code ?? String(error);
export async function readInput(
  path: string,
): Promise<{ text: string | null; state: string; error?: unknown }> {
  try {
    const text = await readFile(path, "utf8");
    return { text, state: hash(text) };
  } catch (error) {
    if (["ENOENT", "ENOTDIR", "EISDIR"].includes(code(error)))
      return {
        text: null,
        state: code(error) === "EISDIR" ? "directory" : "missing",
      };
    return { text: null, state: `error:${code(error)}`, error };
  }
}

/** Directory membership, not file contents. Metadata/content reads are tracked separately. */
export async function treeState(root: string, output: string): Promise<string> {
  const entries: string[] = [];
  let count = 0;
  async function walk(path: string, depth: number) {
    if (depth > 64) throw new Error("Package watch tree exceeds 64 levels");
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (++count > 100000)
        throw new Error("Package watch tree exceeds 100000 entries");
      const child = join(path, entry.name);
      if (
        (contains(root, output) &&
          root !== output &&
          contains(output, child)) ||
        entry.name === ".git" ||
        entry.name === "node_modules"
      )
        continue;
      entries.push(
        `${relative(root, child)}:${entry.isDirectory() ? "d" : entry.isSymbolicLink() ? "l:" + (await readlink(child)) : "f"}`,
      );
      if (entry.isDirectory()) await walk(child, depth + 1);
    }
  }
  try {
    const canonical = await realpath(root);
    await walk(root, 0);
    return hash(JSON.stringify([canonical, entries.sort()]));
  } catch (error) {
    return `error:${code(error)}`;
  }
}
export async function inputState(input: WatchInput, output: string) {
  if (input.kind === "assets") return assetState(input.path, resolve(output));
  return input.kind === "file"
    ? (await readInput(input.path)).state
    : treeState(input.path, resolve(output));
}
