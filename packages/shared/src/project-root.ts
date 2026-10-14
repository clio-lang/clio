import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export interface ProjectLocation {
  readonly root: string;
  readonly entry: string;
  readonly manifest?: string;
}

export function contains(root: string, path: string): boolean {
  const part = relative(root, path);
  return part !== ".." && !part.startsWith(`..${sep}`) && !isAbsolute(part);
}

export function projectSource(manifest: string, text: string): string {
  try {
    const config = Bun.TOML.parse(text) as { build?: { source?: unknown } };
    const source = config.build?.source;
    if (
      typeof source !== "string" ||
      !source.trim() ||
      isAbsolute(source) ||
      /^[A-Za-z]:/.test(source) ||
      source.includes("\\") ||
      source.includes("\0")
    )
      throw new Error("build.source must be a nonempty relative directory");
    const root = resolve(dirname(manifest), source);
    if (!contains(dirname(manifest), root))
      throw new Error("build.source must stay within the project directory");
    return root;
  } catch (error) {
    throw new Error(
      `Invalid project manifest ${manifest}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function findProjectManifest(
  directory: string,
  readManifest?: (path: string) => Promise<string | null>,
): Promise<{ path: string; text: string } | undefined> {
  directory = resolve(directory);
  while (true) {
    const path = resolve(directory, "kalandra.toml");
    let text: string | undefined;
    try {
      text = readManifest
        ? ((await readManifest(path)) ?? undefined)
        : await readFile(path, "utf8");
    } catch (error) {
      if ((error as { code?: string }).code !== "ENOENT")
        throw new Error(`Cannot read ${path}: ${String(error)}`);
    }
    if (text !== undefined) return { path, text };
    const parent = dirname(directory);
    if (parent === directory) return;
    directory = parent;
  }
}

/** Discover from the entry, so the caller's working directory cannot change imports. */
export async function locateProject(
  entry: string,
  options: {
    fallbackRoot?: string;
    readManifest?: (path: string) => Promise<string | null>;
  } = {},
): Promise<ProjectLocation> {
  const absolute = resolve(entry);
  const manifest = await findProjectManifest(
    dirname(absolute),
    options.readManifest,
  );
  if (manifest) {
    const root = projectSource(manifest.path, manifest.text);
    if (!contains(root, absolute) || root === absolute)
      throw new Error(
        `Invalid project manifest ${manifest.path}: Entry ${absolute} is outside build.source ${root}`,
      );
    return {
      root,
      entry: relative(root, absolute).split(sep).join("/"),
      manifest: manifest.path,
    };
  }
  const root = options.fallbackRoot ?? dirname(absolute);
  return { root, entry: relative(root, absolute).split(sep).join("/") };
}
