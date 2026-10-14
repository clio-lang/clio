import { parse } from "@babel/parser";

export const virtualBase = "https://kalandra-playground.invalid/";
/** Link only emitted module syntax, never strings in user literals or comments. */
export function linkModules(
  files: ReadonlyMap<string, { readonly code: string }>,
  runner: string,
  createUrl: (code: string) => string,
) {
  const linked = new Map<string, string>();
  const visiting = new Set<string>();
  const resolve = (path: string, specifier: string) => {
    if (!specifier.startsWith("./") && !specifier.startsWith("../"))
      throw new Error("The playground supports local generated modules only");
    const url = new URL(specifier, virtualBase + path);
    if (url.origin !== new URL(virtualBase).origin)
      throw new Error("External modules are unavailable in the playground");
    const resolved = url.pathname.slice(1);
    if (!files.has(resolved))
      throw new Error(`Missing generated module: ${resolved}`);
    return resolved;
  };
  const link = (path: string): string => {
    if (linked.has(path)) return linked.get(path)!;
    if (visiting.has(path))
      throw new Error(
        "Cyclic module imports are unavailable in the playground",
      );
    const file = files.get(path);
    if (!file) throw new Error(`Missing generated module: ${path}`);
    visiting.add(path);
    const replacements = new Map<number, { end: number; text: string }>();
    const replace = (node: any, value: string) =>
      replacements.set(node.start, {
        end: node.end,
        text: JSON.stringify(value),
      });
    const walk = (node: any): void => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (
        [
          "ImportDeclaration",
          "ExportNamedDeclaration",
          "ExportAllDeclaration",
        ].includes(node.type) &&
        node.source
      )
        replace(node.source, link(resolve(path, node.source.value)));
      if (node.type === "CallExpression" && node.callee?.type === "Import") {
        const source = node.arguments[0];
        if (source?.type !== "StringLiteral")
          throw new Error("Dynamic module paths are unavailable");
        replace(source, link(resolve(path, source.value)));
      }
      if (
        node.type === "NewExpression" &&
        node.callee?.name === "URL" &&
        node.arguments[0]?.type === "StringLiteral" &&
        node.arguments[1]?.type === "MemberExpression" &&
        node.arguments[1].object?.type === "MetaProperty" &&
        node.arguments[1].property?.name === "url"
      ) {
        // Task URL edges can be recursive. The runtime resolves these virtual URLs
        // only when dispatching, after all module blobs have been created.
        replace(
          node.arguments[0],
          virtualBase + resolve(path, node.arguments[0].value),
        );
      }
      for (const [key, value] of Object.entries(node))
        if (!["loc", "tokens", "comments"].includes(key)) walk(value);
    };
    walk(parse(file.code, { sourceType: "module" }));
    let code = file.code;
    for (const [start, { end, text }] of [...replacements].sort(
      (a, b) => b[0] - a[0],
    ))
      code = code.slice(0, start) + text + code.slice(end);
    const url = createUrl(code);
    linked.set(path, url);
    visiting.delete(path);
    return url;
  };
  for (const path of files.keys()) link(path);
  return {
    runner: link(runner),
    modules: Object.fromEntries(
      [...linked].map(([path, url]) => [virtualBase + path, url]),
    ),
  };
}
