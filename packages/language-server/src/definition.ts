import {
  tokenize,
  type ProjectResult,
  type SymbolInfo,
  type SourceSpan,
  type Expression,
  type ImportItem,
  type ImportDeclaration,
} from "@kalandra/compiler";

interface Occurrence {
  span: SourceSpan;
  target: SourceSpan;
  declaration: boolean;
}
const sameSpan = (a: SourceSpan, b: SourceSpan) =>
  a.file === b.file && a.start === b.start && a.end === b.end;

/** Canonical declaration spans identify symbols across aliases and module graphs. */
export function navigationOccurrences(project: ProjectResult): Occurrence[] {
  const occurrences = new Map<string, Occurrence>();
  type Target =
    { path: string; symbol: SymbolInfo } | { path: string; namespace: true };
  function resolve(
    path: string,
    symbol: SymbolInfo,
    visited = new Set<string>(),
  ): Target | null {
    const key = `${path}:${symbol.id}`;
    if (visited.has(key)) return null;
    visited.add(key);
    if (symbol.kind !== "import")
      return symbol.declaration ? { path, symbol } : null;
    const context = project.modules.get(path);
    if (!context) return null;
    for (const [node, dependency] of context.dependencies) {
      const item = node.items.find((item) => item === symbol.declaration);
      if (node !== symbol.declaration && !item) continue;
      if (
        item?.name === "*" &&
        node.items.some((selected) => selected.name !== "*")
      )
        return null;
      if (!item || item.name === "*")
        return { path: dependency, namespace: true };
      const exported = project.modules
        .get(dependency)
        ?.model.exports.get(item.name);
      return exported ? resolve(dependency, exported, visited) : null;
    }
    return null; // No source definitions for external packages.
  }
  function memberTarget(path: string, node: Expression): Target | null {
    if (node.kind === "Member") {
      const base = memberTarget(path, node.object);
      if (!base || !("namespace" in base)) return null;
      const symbol = project.modules
        .get(base.path)
        ?.model.exports.get(node.property);
      return symbol ? resolve(base.path, symbol) : null;
    }
    const symbol = project.modules.get(path)!.model.bindings.get(node);
    return symbol ? resolve(path, symbol) : null;
  }
  function span(target: Target | null): SourceSpan | null {
    if (!target) return null;
    if ("namespace" in target) return { file: target.path, start: 0, end: 0 };
    return symbolSpan(project, target.path, target.symbol);
  }
  const add = (
    range: SourceSpan | null,
    target: Target | null,
    declaration = false,
  ) => {
    const resolved = span(target);
    if (!range || !resolved) return;
    const key = JSON.stringify([range.file, range.start, range.end]);
    const previous = occurrences.get(key);
    occurrences.set(key, {
      span: range,
      target: resolved,
      declaration: declaration || previous?.declaration === true,
    });
  };
  for (const [path, module] of project.modules) {
    const tokens = tokenize(project.sources.get(path)!).tokens;
    for (const raw of module.model.types.keys()) {
      const node = raw as Expression;
      if (node.kind === "Member")
        add(
          { ...node.span, start: node.span.end - node.property.length },
          memberTarget(path, node),
        );
    }
    for (const [raw, symbol] of module.model.bindings) {
      const node = raw as Expression | ImportItem | ImportDeclaration;
      const target = resolve(path, symbol);
      if (node.kind === "Identifier" || node.kind === "Parameter")
        add(node.span, target);
      if (node.kind === "ImportItem" || node.kind === "ImportDeclaration") {
        const names = tokens.filter(
          (token) =>
            token.tokenType.name === "Identifier" &&
            token.startOffset >= node.span.start &&
            token.startOffset < node.span.end,
        );
        for (const token of names) {
          const isAlias = node.alias !== null && token === names.at(-1);
          add(
            {
              file: path,
              start: token.startOffset,
              end: token.startOffset + token.image.length,
            },
            target,
            isAlias,
          );
        }
      }
    }
    for (const scope of module.model.scopes)
      for (const symbol of scope.symbols.values())
        if (symbol.kind !== "import")
          add(symbolSpan(project, path, symbol), resolve(path, symbol), true);
  }
  return [...occurrences.values()];
}

/** Resolve semantic identities; never guess targets from matching spelling. */
export function definitionAt(
  project: ProjectResult,
  path: string,
  offset: number,
): SourceSpan | null {
  return (
    navigationOccurrences(project).find(
      ({ span }) =>
        span.file === path && span.start <= offset && offset < span.end,
    )?.target ?? null
  );
}

export function referencesAt(
  project: ProjectResult,
  path: string,
  offset: number,
  includeDeclaration: boolean,
): SourceSpan[] {
  const occurrences = navigationOccurrences(project);
  const selected = occurrences.find(
    ({ span }) =>
      span.file === path && span.start <= offset && offset < span.end,
  );
  if (!selected) return [];
  return occurrences
    .filter(
      (item) =>
        sameSpan(item.target, selected.target) &&
        (includeDeclaration || !item.declaration),
    )
    .map((item) => item.span)
    .sort((a, b) => a.file.localeCompare(b.file) || a.start - b.start);
}

/** Exact declaration token range shared by navigation and hover. */
export function symbolSpan(
  project: ProjectResult,
  path: string,
  symbol: SymbolInfo,
): SourceSpan | null {
  const node = symbol.declaration;
  if (!node || !("kind" in node) || typeof node.kind !== "string") return null;
  if (node.kind === "Group" && symbol.kind === "parameter") {
    const occurrences = [...project.modules.get(path)!.model.bindings]
      .filter(
        ([occurrence, bound]) =>
          "kind" in occurrence &&
          occurrence.kind === "Parameter" &&
          bound.id === symbol.id,
      )
      .map(([occurrence]) => occurrence.span)
      .sort((a, b) => a.start - b.start);
    return occurrences[0] ?? null;
  }
  if (
    ["FunctionDeclaration", "TypeDeclaration", "ListDeclaration"].includes(
      node.kind,
    )
  ) {
    const source = project.sources.get(path)!;
    const tokens = tokenize(source).tokens.filter(
      (token) =>
        token.startOffset >= node.span.start &&
        token.startOffset < node.span.end &&
        token.tokenType.name === "Identifier",
    );
    let index = 0;
    if (symbol.kind === "parameter" && node.kind === "FunctionDeclaration") {
      const info = project.modules
        .get(path)
        ?.model.functions.find((info) => info.node === node);
      index =
        1 +
        (info?.parameters.findIndex(
          (parameter) => parameter.id === symbol.id,
        ) ?? -1);
    }
    const token = tokens[index];
    if (token)
      return {
        file: path,
        start: token.startOffset,
        end: token.startOffset + token.image.length,
      };
  }
  return node.span;
}
