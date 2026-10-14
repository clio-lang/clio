import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  SemanticType,
  ExternalResolution,
} from "../../compiler/src/index.js";
import { contains } from "./project-root.js";

type RecordValue = Record<string, unknown>;
function object(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a declaration object");
  return value as RecordValue;
}
function keys(value: RecordValue, allowed: string[]) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      throw new Error(`Unknown declaration field: ${key}`);
}

export function parseExternalTypes(
  text: string,
): ReadonlyMap<string, Omit<ExternalResolution, "specifier">> {
  if (text.length > 1024 * 1024)
    throw new Error("Declaration file exceeds 1 MiB");
  const document = object(JSON.parse(text));
  keys(document, ["version", "modules"]);
  if (document.version !== 1)
    throw new Error("Unsupported Kalandra declaration version");
  let count = 0;
  function type(value: unknown, depth = 0): SemanticType {
    if (++count > 4096 || depth > 32)
      throw new Error("Declaration type complexity limit exceeded");
    if (typeof value === "string") {
      if (
        [
          "Any",
          "Number",
          "String",
          "Boolean",
          "Null",
          "Void",
          "Object",
          "Function",
        ].includes(value)
      )
        return { kind: value } as SemanticType;
      throw new Error(`Unknown declaration type: ${value}`);
    }
    const node = object(value);
    const next = (value: unknown) => type(value, depth + 1);
    if (node.kind === "Callable") {
      keys(node, ["kind", "parameters", "returns", "async"]);
      if (!Array.isArray(node.parameters) || typeof node.async !== "boolean")
        throw new Error(
          "Callable requires parameters, returns, and boolean async",
        );
      return {
        kind: "Callable",
        parameters: node.parameters.map(next),
        returns: next(node.returns),
        async: node.async,
      };
    }
    if (node.kind === "Union") {
      keys(node, ["kind", "members"]);
      if (!Array.isArray(node.members) || node.members.length < 2)
        throw new Error("Union requires at least two members");
      return { kind: "Union", members: node.members.map(next) };
    }
    if (
      node.kind === "Array" ||
      node.kind === "Set" ||
      node.kind === "Range" ||
      node.kind === "Promise"
    ) {
      keys(node, ["kind", "element"]);
      return { kind: node.kind, element: next(node.element) };
    }
    throw new Error(`Unsupported declaration type kind: ${String(node.kind)}`);
  }
  const result = new Map<string, Omit<ExternalResolution, "specifier">>();
  for (const [path, value] of Object.entries(object(document.modules))) {
    if (
      !/^(esm|cjs):\.(\/[^\\\s?#:]+)?$/.test(path) ||
      path
        .split("/")
        .slice(1)
        .some((part) => !part || part === "." || part === "..")
    )
      throw new Error(`Invalid declaration module: ${path}`);
    const node = object(value);
    keys(node, ["exports", "value"]);
    const exports: Record<string, SemanticType> = Object.create(null);
    for (const [name, value] of Object.entries(object(node.exports)))
      exports[name] = type(value);
    if (node.value !== undefined && !path.startsWith("cjs:"))
      throw new Error("Only CommonJS declarations accept value");
    result.set(path, {
      exports,
      ...(node.value !== undefined ? { value: type(node.value) } : {}),
    });
  }
  return result;
}

/** Resolve and read metadata only. No module evaluation, scripts or TypeScript inference. */
export async function resolveExternalTypes(
  dependency: { kind: "esm" | "cjs"; specifier: string },
  importer: string,
  read: (absolute: string) => Promise<string | null>,
): Promise<ExternalResolution> {
  const resolved = Bun.resolveSync(dependency.specifier, dirname(importer));
  if (resolved.startsWith("node:") || dependency.specifier.startsWith("node:"))
    return { specifier: resolved };
  const specifier = pathToFileURL(resolved).href;
  const parts = dependency.specifier.split("/");
  const count = dependency.specifier.startsWith("@") ? 2 : 1;
  const name = parts.slice(0, count).join("/");
  const subpath =
    parts.length === count ? "." : "./" + parts.slice(count).join("/");
  let directory = dirname(resolved);
  while (true) {
    const manifest = await read(resolve(directory, "package.json"));
    if (manifest !== null) {
      const config = object(JSON.parse(manifest));
      if (config.name === name) {
        if (config.kalandra === undefined) return { specifier };
        const kalandra = object(config.kalandra);
        const path = kalandra.types;
        if (
          typeof path !== "string" ||
          !path.endsWith(".json") ||
          isAbsolute(path) ||
          path.includes("\\") ||
          path.includes("\0") ||
          !contains(directory, resolve(directory, path))
        )
          throw new Error(
            "package.json kalandra.types must name a JSON file inside the package",
          );
        const text = await read(resolve(directory, path));
        if (text === null)
          throw new Error(`Missing Kalandra declarations: ${path}`);
        return {
          specifier,
          ...parseExternalTypes(text).get(`${dependency.kind}:${subpath}`),
        };
      }
    }
    const parent = dirname(directory);
    if (parent === directory) return { specifier };
    directory = parent;
  }
}
