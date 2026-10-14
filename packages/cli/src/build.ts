import { basename, dirname, resolve } from "node:path";
import {
  mkdir,
  realpath,
  stat,
  readFile as readBytes,
  rm,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolveExternalTypes } from "../../shared/src/external-types.js";
import { locateProject } from "./project-root.js";
import { readInput } from "./watch-inputs.js";
import {
  assetIndex,
  collectAssets,
  digest,
  outputIdentity,
  previousAssets,
} from "./assets.js";
import { contains } from "../../shared/src/project-root.js";
import { compileProject } from "@kalandra/compiler";

export interface BuildTracking {
  read(path: string): Promise<string | null>;
  directory(path: string): Promise<void>;
  assets?(path: string): Promise<void>;
}

export async function buildProject(
  entry: string,
  output: string,
  strict: boolean,
  quiet = false,
  tracking?: BuildTracking,
  remoteServices?: Readonly<Record<string, string>>,
): Promise<string | undefined> {
  const inputFiles = new Set<string>();
  const readFile =
    tracking?.read ??
    (async (path: string) => {
      const input = await readInput(path);
      if (input.error) throw input.error;
      return input.text;
    });
  const read = (path: string) => {
    inputFiles.add(resolve(path));
    return readFile(path);
  };
  let location;
  try {
    location = await locateProject(entry, {
      readManifest: async (path) => {
        const text = await read(path);
        if (
          text === null &&
          (await stat(path).catch(() => null))?.isDirectory()
        )
          throw new Error(`Manifest must be a file: ${path}`);
        return text;
      },
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }
  const { root } = location;
  if (location.manifest) await tracking?.assets?.(root);
  const externalFiles = new Set<string>();
  const result = await compileProject(
    location.entry,
    {
      parseKalandraManifest: (text) => Bun.TOML.parse(text),
      async resolveExternal(dependency, importer) {
        if (tracking && !dependency.specifier.startsWith("node:")) {
          const segments = dependency.specifier.split("/");
          const name = segments
            .slice(0, dependency.specifier.startsWith("@") ? 2 : 1)
            .join("/");
          let directory = dirname(resolve(root, importer));
          while (true) {
            await tracking.directory(resolve(directory, "node_modules", name));
            await read(
              resolve(directory, "node_modules", name, "package.json"),
            );
            await read(resolve(directory, "package.json"));
            const parent = dirname(directory);
            if (parent === directory) break;
            directory = parent;
          }
        }
        const resolution = await resolveExternalTypes(
          dependency,
          resolve(root, importer),
          async (path) => {
            externalFiles.add(path);
            return read(path);
          },
        );
        if (resolution.specifier.startsWith("file:")) {
          const path = fileURLToPath(resolution.specifier);
          externalFiles.add(path);
          if (tracking) await read(path);
        }
        return resolution;
      },
      readSource: (path) => read(resolve(root, path)),
    },
    { strictNames: strict, ...(remoteServices ? { remoteServices } : {}) },
  );
  for (const diagnostic of result.diagnostics) {
    const source = result.sources.get(diagnostic.span?.file ?? "");
    const offset = diagnostic.span?.start ?? 0;
    const prefix = source?.text.slice(0, offset) ?? "";
    console.error(
      `${source?.path ?? entry}:${prefix.split("\n").length}:${offset - prefix.lastIndexOf("\n")} ${diagnostic.code} (${diagnostic.severity}): ${diagnostic.message}`,
    );
  }
  if (!result.output) {
    process.exitCode = 1;
    return;
  }
  try {
    const identity = async (path: string) =>
      realpath(path).catch(() => resolve(path));
    const inputs = new Set(
      await Promise.all(
        [
          ...[...(result.manifests?.keys() ?? [])].map((path) =>
            resolve(root, path),
          ),
          ...[...result.sources.keys()].map((path) => resolve(root, path)),
          ...externalFiles,
          ...inputFiles,
          ...(location.manifest ? [location.manifest] : []),
        ].map(identity),
      ),
    );
    const outputRoot = await outputIdentity(resolve(output));
    const sourceRoot = await realpath(root);
    if (location.manifest && contains(outputRoot, sourceRoot))
      throw new Error("Output must not contain the source root");
    const assets = location.manifest
      ? await collectAssets(root, output)
      : new Map<string, Uint8Array>();
    for (const name of assets.keys())
      inputs.add(await identity(resolve(root, name)));
    const previous = location.manifest
      ? await previousAssets(resolve(output))
      : {};
    const outputs = new Set<string>();
    const staged: { path: string; text: string | Uint8Array }[] = [];
    for (const [name, bytes] of assets)
      staged.push({ path: resolve(output, name), text: bytes });
    for (const [path, file] of result.output.files) {
      const target = resolve(output, path);
      if (file.sourceMap) {
        const mapPath = target + ".map";
        staged.push({
          path: mapPath,
          text:
            JSON.stringify({
              ...JSON.parse(file.sourceMap),
              file: basename(target),
            }) + "\n",
        });
        staged.push({
          path: target,
          text: `${file.code}\n//# sourceMappingURL=${encodeURIComponent(basename(mapPath))}\n`,
        });
      } else staged.push({ path: target, text: file.code + "\n" });
    }
    if (location.manifest)
      staged.push({
        path: resolve(output, assetIndex),
        text: JSON.stringify({
          version: 1,
          source: sourceRoot,
          files: Object.fromEntries(
            [...assets].map(([name, bytes]) => [name, digest(bytes)]),
          ),
        }),
      });
    // Validate every destination before the first write.
    for (const item of staged) {
      if (inputs.has(await identity(item.path)))
        throw new Error("Output must not overwrite a source file");
      const key = await outputIdentity(item.path, resolve(output));
      if (!contains(outputRoot, key))
        throw new Error("Output path escapes output directory");
      if (inputs.has(key))
        throw new Error("Output must not overwrite a source file");
      if (outputs.has(key))
        throw new Error("Output files must have separate destinations");
      outputs.add(key);
    }
    for (const key of outputs) {
      let parent = dirname(key);
      while (contains(outputRoot, parent) && parent !== outputRoot) {
        if (outputs.has(parent))
          throw new Error("Output file/directory collision");
        parent = dirname(parent);
      }
      if ((await stat(key).catch(() => null))?.isDirectory())
        throw new Error("Output file collides with a directory");
    }
    const removals: string[] = [];
    for (const [name, hash] of Object.entries(previous)) {
      if (assets.has(name) || outputs.has(resolve(outputRoot, name))) continue;
      const target = resolve(output, name);
      const key = await outputIdentity(target, resolve(output));
      if (inputs.has(key))
        throw new Error("Asset cleanup must not remove an input");
      const bytes = await readBytes(target).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return null;
          throw error;
        },
      );
      if (bytes && digest(bytes) === hash) removals.push(target);
    }
    for (const item of staged) {
      await mkdir(dirname(item.path), { recursive: true });
      await Bun.write(item.path, item.text);
    }
    for (const path of removals) await rm(path);
    if (!quiet)
      console.log(
        `Built ${result.sources.size} source files → ${resolve(output, result.output.entry)}`,
      );
    return resolve(output, result.output.runner);
  } catch (error) {
    console.error(
      `Cannot write project output: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
