import { basename, dirname, relative, resolve, sep } from "node:path";
import { readFile, readdir, realpath } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SourceDiscoveryError, sourceExclusions } from "./source-discovery.js";
import { resolveExternalTypes } from "../../shared/src/external-types.js";
import { contains, locateProject } from "../../shared/src/project-root.js";
import type { WorkspaceHost } from "./workspace.js";

function filePath(uri: string): string | undefined {
  try {
    const url = new URL(uri);
    if (url.protocol !== "file:" || url.search || url.hash) return;
    return fileURLToPath(url);
  } catch {
    return;
  }
}
export function fileWorkspaceHost(
  roots: readonly string[],
  discoveryLimits: {
    maxEntries?: number;
    maxDepth?: number;
    sourceExcludes?: unknown;
  } = {},
): WorkspaceHost {
  const exclude = sourceExclusions(discoveryLimits.sourceExcludes);
  const paths = roots
    .map(filePath)
    .filter((path): path is string => !!path)
    .map((path) => resolve(path))
    .sort((a, b) => b.length - a.length);
  const workspaceFor = (path: string) =>
    paths.find((root) => contains(root, path));
  const isConfiguration = (uri: string) => {
    const path = filePath(uri);
    return (
      !!path && (basename(path) === "kalandra.toml" || path.endsWith(".json"))
    );
  };
  const readManifest =
    (overlays?: ReadonlyMap<string, string>) => async (path: string) => {
      const uri = pathToFileURL(path).href;
      if (overlays?.has(uri)) return overlays.get(uri)!;
      try {
        return await readFile(path, "utf8");
      } catch (error) {
        if ((error as { code?: string }).code === "ENOENT") return null;
        throw error;
      }
    };
  return {
    parseKalandraManifest: (text) => Bun.TOML.parse(text),
    isConfiguration,
    async resolveExternal(root, dependency, importer, overlays) {
      // Bun resolves package files through symlinks. Match configuration overlays to those paths too.
      const metadata = new Map(overlays);
      for (const [uri, text] of overlays) {
        const path = filePath(uri);
        if (!path?.endsWith(".json")) continue;
        const canonical = await realpath(path).catch(async () =>
          resolve(
            await realpath(dirname(path)).catch(() => dirname(path)),
            basename(path),
          ),
        );
        metadata.set(pathToFileURL(canonical).href, text);
      }
      return resolveExternalTypes(
        dependency,
        resolve(root, importer),
        readManifest(metadata),
      );
    },
    async locate(uri, overlays) {
      const path = filePath(uri);
      if (!path || !path.endsWith(".kalandra")) return;
      const fallbackRoot = workspaceFor(path) ?? dirname(path);
      try {
        const location = await locateProject(path, {
          fallbackRoot,
          readManifest: readManifest(overlays),
        });
        return { root: location.root, path: location.entry };
      } catch (error) {
        return {
          root: fallbackRoot,
          path: relative(fallbackRoot, path).split(sep).join("/"),
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    uri: (root, path) => pathToFileURL(resolve(root, path)).href,
    async listSources(root, overlays) {
      // Without a configured workspace, retain open-graph behavior.
      if (!workspaceFor(root)) return [];
      const manifestAt = readManifest(overlays);
      const files: string[] = [];
      let count = 0;
      const excluded = new Set(["node_modules", "dist", "build", "coverage"]);
      const maxEntries = discoveryLimits.maxEntries ?? 50000;
      const maxDepth = discoveryLimits.maxDepth ?? 64;
      async function visit(directory: string, depth: number) {
        if (depth > maxDepth)
          throw new SourceDiscoveryError(
            "Source discovery exceeded its directory depth limit; choose a narrower workspace root.",
          );
        let entries;
        try {
          entries = await readdir(directory, { withFileTypes: true });
        } catch {
          throw new SourceDiscoveryError(
            `Cannot enumerate source directory ${directory}; no partial search or rename was returned.`,
          );
        }
        for (const entry of entries.sort((a, b) =>
          a.name.localeCompare(b.name),
        )) {
          if (++count > maxEntries)
            throw new SourceDiscoveryError(
              "Source discovery exceeded its entry limit; choose a narrower workspace root.",
            );
          if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
          const path = resolve(directory, entry.name);
          const local = relative(root, path).split(sep).join("/");
          if (exclude(local) || (entry.isDirectory() && exclude(local + "/")))
            continue;
          if (entry.isDirectory()) {
            if (!excluded.has(entry.name) && !paths.includes(path)) {
              let manifest;
              try {
                manifest = await manifestAt(resolve(path, "kalandra.toml"));
              } catch {
                throw new SourceDiscoveryError(
                  `Cannot inspect project boundary ${path}; no partial search or rename was returned.`,
                );
              }
              // A nested project has its own source root, even with invalid configuration.
              if (manifest === null) await visit(path, depth + 1);
            }
          } else if (entry.isFile() && entry.name.endsWith(".kalandra")) {
            files.push(relative(root, path).split(sep).join("/"));
          }
        }
      }
      await visit(root, 0);
      return files.sort();
    },
    async read(root, path) {
      try {
        return await readFile(resolve(root, path), "utf8");
      } catch (error) {
        if (
          ["ENOENT", "ENOTDIR", "EISDIR"].includes(
            (error as { code: string }).code,
          )
        )
          return null;
        throw error;
      }
    },
  };
}
