import {
  analyze,
  analyzeProject,
  tokenize,
  type ProjectResult,
  type SymbolInfo,
  type SourceSpan,
  type Expression,
  type ImportItem,
  type ImportDeclaration,
  type AnalysisOptions,
  type ProjectModule,
  type ProjectHost,
  type Decorator,
} from "@kalandra/compiler";
import { symbolSpan } from "./definition.js";

export class RenameError extends Error {}
interface Identity {
  path: string;
  symbol: SymbolInfo;
}
interface Occurrence {
  span: SourceSpan;
  identity: Identity | null;
}
const key = (identity: Identity) =>
  JSON.stringify([identity.path, identity.symbol.id]);

/** Unlike references, rename preserves explicit aliases as independent names. */
function renameIndex(project: ProjectResult) {
  const occurrences = new Map<string, Occurrence>();
  const links = new Map<string, Identity>();
  const declarations = new Map<string, SourceSpan>();
  const tokens = new Map(
    [...project.sources].map(([path, source]) => [
      path,
      tokenize(source).tokens,
    ]),
  );
  const nameTokens = (path: string, span: SourceSpan) =>
    tokens
      .get(path)!
      .filter(
        (token) =>
          token.tokenType.name === "Identifier" &&
          token.startOffset >= span.start &&
          token.startOffset < span.end,
      );
  const tokenSpan = (
    path: string,
    token: { startOffset: number; image: string },
  ): SourceSpan => ({
    file: path,
    start: token.startOffset,
    end: token.startOffset + token.image.length,
  });
  const add = (span: SourceSpan, identity: Identity | null) => {
    // @ is syntax, not part of the editable name.
    if (project.sources.get(span.file)!.text[span.start] === "@")
      span = { ...span, start: span.start + 1 };
    occurrences.set(JSON.stringify([span.file, span.start, span.end]), {
      span,
      identity,
    });
  };
  function imported(identity: Identity) {
    const module = project.modules.get(identity.path)!;
    for (const [node, path] of module.dependencies) {
      const item = node.items.find(
        (item) => item === identity.symbol.declaration,
      );
      if (node === identity.symbol.declaration || item)
        return { node, item, path };
    }
    return null;
  }
  function namespace(
    identity: Identity,
    visited = new Set<string>(),
  ): string | null {
    if (identity.symbol.kind !== "import" || visited.has(key(identity)))
      return null;
    visited.add(key(identity));
    const dependency = imported(identity);
    if (!dependency) return null;
    const { node, item, path } = dependency;
    if (!item || (item.name === "*" && node.items.length === 1)) return path;
    if (item.name === "*") return null;
    const symbol = project.modules.get(path)?.model.exports.get(item.name);
    return symbol ? namespace({ path, symbol }, visited) : null;
  }
  function member(path: string, node: Expression): Identity | null {
    if (node.kind !== "Member") {
      const symbol = project.modules.get(path)!.model.bindings.get(node);
      return symbol ? { path, symbol } : null;
    }
    const base = member(path, node.object);
    const dependency = base && namespace(base);
    const symbol =
      dependency &&
      project.modules.get(dependency)?.model.exports.get(node.property);
    return symbol && dependency ? { path: dependency, symbol } : null;
  }
  for (const [path, module] of project.modules) {
    for (const scope of module.model.scopes)
      for (const symbol of scope.symbols.values()) {
        const identity = { path, symbol };
        if (symbol.kind === "import") {
          const node = symbol.declaration as ImportItem | ImportDeclaration;
          const names = nameTokens(path, node.span);
          const local = node.alias
            ? names.at(-1)
            : node.kind === "ImportItem" && node.name !== "*"
              ? names[0]
              : undefined;
          if (local) {
            const span = tokenSpan(path, local);
            declarations.set(key(identity), span);
            add(span, identity);
          }
          const dependency = imported(identity);
          if (dependency?.item && dependency.item.name !== "*") {
            const exported = project.modules
              .get(dependency.path)
              ?.model.exports.get(dependency.item.name);
            const source = names[0];
            if (exported && source) {
              const target = { path: dependency.path, symbol: exported };
              add(tokenSpan(path, source), target);
              if (!node.alias) links.set(key(identity), target);
            }
          }
        } else {
          const span = symbolSpan(project, path, symbol);
          if (span) {
            const editable =
              project.sources.get(path)!.text[span.start] === "@"
                ? { ...span, start: span.start + 1 }
                : span;
            declarations.set(key(identity), editable);
            add(span, identity);
          }
        }
      }
    for (const [raw, symbol] of module.model.bindings) {
      const node = raw as Expression;
      if (node.kind === "Identifier" || node.kind === "Parameter")
        add(node.span, { path, symbol });
    }
    function decorators(value: unknown) {
      if (!value || typeof value !== "object") return;
      if ("kind" in value && value.kind === "Decorator") {
        const node = value as Decorator;
        const names = tokens
          .get(path)!
          .filter(
            (token) =>
              ["Parameter", "Identifier"].includes(token.tokenType.name) &&
              token.startOffset >= node.span.start &&
              token.startOffset < node.span.end,
          )
          .slice(0, node.name.length);
        const root = module.model.bindings.get(node);
        let target: Identity | null = root ? { path, symbol: root } : null;
        for (const [index, token] of names.entries()) {
          if (index > 0) {
            const dependency: string | null = target && namespace(target);
            const symbol: SymbolInfo | undefined = dependency
              ? project.modules
                  .get(dependency)
                  ?.model.exports.get(node.name[index]!)
              : undefined;
            target = symbol && dependency ? { path: dependency, symbol } : null;
          }
          add(tokenSpan(path, token), target);
        }
      }
      for (const child of Object.values(value)) decorators(child);
    }
    decorators(module.program);
    for (const raw of module.model.types.keys()) {
      const node = raw as Expression;
      if (node.kind === "Identifier" && !module.model.bindings.has(node))
        add(node.span, null);
      if (node.kind === "Member")
        add(
          { ...node.span, start: node.span.end - node.property.length },
          member(path, node),
        );
    }
  }
  function canonical(identity: Identity): Identity {
    const seen = new Set<string>();
    while (links.has(key(identity)) && !seen.has(key(identity))) {
      seen.add(key(identity));
      identity = links.get(key(identity))!;
    }
    return identity;
  }
  return { occurrences: [...occurrences.values()], declarations, canonical };
}
function selection(project: ProjectResult, path: string, offset: number) {
  const index = renameIndex(project);
  const occurrence = index.occurrences.find(
    ({ span }) =>
      span.file === path && span.start <= offset && offset < span.end,
  );
  if (!occurrence?.identity) return null;
  const identity = index.canonical(occurrence.identity);
  if (
    !index.declarations.has(key(identity)) ||
    ["builtin", "external"].includes(identity.symbol.kind)
  )
    return null;
  if (identity.symbol.kind === "import") {
    const node = identity.symbol.declaration as ImportItem | ImportDeclaration;
    if (!node.alias) return null; // External or implicit namespace names need an explicit alias.
  }
  return { index, occurrence, identity };
}

export function prepareRename(
  project: ProjectResult,
  path: string,
  offset: number,
) {
  const selected = selection(project, path, offset);
  if (!selected) return null;
  return {
    span: selected.occurrence.span,
    placeholder: selected.identity.symbol.name,
  };
}

export async function renameProject(
  project: ProjectResult,
  path: string,
  offset: number,
  newName: string,
  options: AnalysisOptions,
  fileBacked: boolean,
  parseKalandraManifest?: ProjectHost["parseKalandraManifest"],
): Promise<SourceSpan[]> {
  const name = tokenize({ path: "name.kalandra", text: newName });
  if (
    name.diagnostics.length ||
    name.tokens.filter((token) => token.image).length !== 1 ||
    name.tokens[0]?.tokenType.name !== "Identifier" ||
    name.tokens[0]?.image !== newName
  )
    throw new RenameError(
      "Use a single identifier, without @, whitespace, or a reserved keyword.",
    );
  const selected = selection(project, path, offset);
  if (!selected)
    throw new RenameError("This name has no supported rename target.");
  if (project.diagnostics.some((diagnostic) => diagnostic.severity === "error"))
    throw new RenameError(
      "Fix analysis errors in the searched project sources before renaming.",
    );
  const { index, identity } = selected;
  const edits = index.occurrences
    .filter(
      (item) =>
        item.identity && key(index.canonical(item.identity)) === key(identity),
    )
    .map((item) => item.span);
  const changed = new Map(
    [...project.sources].map(([path, source]) => [path, source.text]),
  );
  for (const [path, text] of changed) {
    let next = text;
    for (const span of edits
      .filter((span) => span.file === path)
      .sort((a, b) => b.start - a.start))
      next = next.slice(0, span.start) + newName + next.slice(span.end);
    changed.set(path, next);
  }
  const modules = new Map<string, ProjectModule>();
  const sources = new Map(project.sources);
  for (const [entry, text] of changed) {
    if (fileBacked) {
      const result = await analyzeProject(
        entry,
        {
          parseKalandraManifest,
          resolveExternal: async (dependency, importer) =>
            project.externals?.get(
              JSON.stringify([
                importer,
                `${dependency.kind}:${dependency.specifier}`,
              ]),
            ) ?? dependency.specifier,
          readSource: async (path) =>
            changed.get(path) ?? project.manifests?.get(path)?.text ?? null,
        },
        options,
      );
      if (
        result.diagnostics.some((diagnostic) => diagnostic.severity === "error")
      )
        throw new RenameError(
          "The new name causes a declaration, import, or type conflict.",
        );
      for (const [path, module] of result.modules) modules.set(path, module);
      for (const [path, source] of result.sources) sources.set(path, source);
    } else {
      const result = analyze({ path: entry, text }, options);
      if (
        !result.model ||
        !result.program ||
        result.diagnostics.some((diagnostic) => diagnostic.severity === "error")
      )
        throw new RenameError(
          "The new name causes a declaration or type conflict.",
        );
      modules.set(entry, {
        model: result.model,
        program: result.program,
        dependencies: new Map(),
      });
      sources.set(entry, { path: entry, text });
    }
  }
  const after = renameIndex({ modules, sources, diagnostics: [] });
  const afterOccurrences = new Map(
    after.occurrences.map((item) => [
      JSON.stringify([item.span.file, item.span.start]),
      item,
    ]),
  );
  const movedStart = (span: SourceSpan) =>
    span.start +
    edits
      .filter((edit) => edit.file === span.file && edit.end <= span.start)
      .reduce(
        (delta, edit) => delta + newName.length - (edit.end - edit.start),
        0,
      );
  // Every binding, including unrelated and previously unresolved names, must retain its identity.
  for (const before of index.occurrences) {
    const current = afterOccurrences.get(
      JSON.stringify([before.span.file, movedStart(before.span)]),
    );
    const identityKey = (item: Occurrence) =>
      item.identity ? key(item.identity) : null;
    if (!current || identityKey(before) !== identityKey(current))
      throw new RenameError(
        "The new name would capture or change the meaning of an existing reference.",
      );
  }
  return edits.sort(
    (a, b) => a.file.localeCompare(b.file) || a.start - b.start,
  );
}
