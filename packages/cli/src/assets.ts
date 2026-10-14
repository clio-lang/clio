import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { contains } from "../../shared/src/project-root.js";

export const assetIndex = ".kalandra-assets.json";
export const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const excluded = (name: string) =>
  name.startsWith(".") ||
  name === "node_modules" ||
  name.endsWith(".kalandra") ||
  ["kalandra.toml", "kalandra.lock"].includes(name);

/** Do not follow links: resources must be regular files owned by this source tree. */
export async function collectAssets(root: string, output: string) {
  root = await realpath(root);
  output = await outputIdentity(resolve(output));
  const files = new Map<string, Uint8Array>();
  let count = 0;
  async function walk(directory: string, depth: number) {
    if (depth > 64) throw new Error("Asset tree exceeds 64 levels");
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (++count > 100000)
        throw new Error("Asset tree exceeds 100000 entries");
      const path = join(directory, entry.name);
      if (excluded(entry.name) || contains(output, path)) continue;
      if (entry.isSymbolicLink())
        throw new Error(`Asset symlinks are not supported: ${path}`);
      if (entry.isDirectory()) await walk(path, depth + 1);
      else if (entry.isFile())
        files.set(relative(root, path), await readFile(path));
      else throw new Error(`Asset must be a regular file: ${path}`);
    }
  }
  await walk(root, 0);
  return files;
}

export async function assetState(
  root: string,
  output: string,
): Promise<string> {
  try {
    const files = await collectAssets(root, output);
    return JSON.stringify(
      [...files].map(([path, data]) => [path, digest(data)]).sort(),
    );
  } catch (error) {
    return `error:${String(error)}`;
  }
}

/** Resolve even missing destinations through existing parents; refuse output symlinks. */
async function resolveMissing(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
    return join(
      await resolveMissing(dirname(path)),
      relative(dirname(path), path),
    );
  }
}
export async function outputIdentity(
  path: string,
  boundary = path,
): Promise<string> {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink())
      throw new Error(`Output must not use symlinks: ${path}`);
    if (!info.isDirectory() && !info.isFile())
      throw new Error(`Unsupported output path: ${path}`);
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
  const parent = dirname(path);
  if (parent === path) return realpath(path);
  const canonicalParent =
    path === boundary
      ? await resolveMissing(parent)
      : await outputIdentity(parent, boundary);
  return join(canonicalParent, relative(parent, path));
}

export async function previousAssets(
  output: string,
): Promise<Record<string, string>> {
  const path = join(output, assetIndex);
  await outputIdentity(path, output);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return {};
    throw error;
  }
  const value = JSON.parse(text);
  if (
    value.version !== 1 ||
    typeof value.source !== "string" ||
    !value.files ||
    typeof value.files !== "object" ||
    Array.isArray(value.files)
  )
    throw new Error("Invalid asset ownership index");
  for (const [name, hash] of Object.entries(value.files)) {
    if (
      !name ||
      name
        .split(/[\\/]/)
        .some(
          (part) => !part || part === "." || part === ".." || excluded(part),
        ) ||
      !contains(output, resolve(output, name)) ||
      typeof hash !== "string" ||
      !/^[a-f0-9]{64}$/.test(hash)
    )
      throw new Error("Invalid asset ownership index");
  }
  return value.files;
}
