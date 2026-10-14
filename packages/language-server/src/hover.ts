import { tokenize } from "@kalandra/compiler";
import type {
  ProjectResult,
  SemanticType,
  SourceSpan,
  Expression,
  ImportItem,
} from "@kalandra/compiler";
import { symbolSpan } from "./definition.js";

/** Display compiler types without adding inference or suggesting Any is concrete. */
export function formatType(type: SemanticType, depth = 0): string {
  if (depth > 8) return "…";
  const next = (type: SemanticType) => formatType(type, depth + 1);
  switch (type.kind) {
    case "Callable":
      return `${type.async ? "async " : ""}fn (${type.parameters.map(next).join(", ")}) -> ${next(type.returns)}`;
    case "Array":
    case "Set":
    case "Range":
    case "Promise":
      return `${type.kind}<${next(type.element)}>`;
    case "Union":
      return type.members.map(next).join(" | ");
    case "TypeValue":
      return `${type.callable === false ? "ListType" : "Type"}<${next(type.instance)}>`;
    case "Named":
      return type.name;
    default:
      return type.kind;
  }
}
export function hoverAt(
  project: ProjectResult,
  path: string,
  offset: number,
): { text: string; span: SourceSpan } | null {
  const module = project.modules.get(path);
  if (!module) return null;
  const contains = (span: SourceSpan) =>
    span.start <= offset && offset < span.end;
  const display = (name: string, type: SemanticType, span: SourceSpan) => ({
    text: `${name}: ${formatType(type)}`,
    span,
  });
  for (const [raw, type] of module.model.types) {
    const node = raw as Expression;
    if (node.kind === "Member") {
      const span = {
        ...node.span,
        start: node.span.end - node.property.length,
      };
      if (contains(span)) return display(node.property, type, span);
    }
  }
  for (const [raw, symbol] of module.model.bindings) {
    const node = raw as Expression | ImportItem;
    if (node.kind === "ImportItem" && contains(node.span)) {
      const token = tokenize(project.sources.get(path)!).tokens.find(
        (token) =>
          token.tokenType.name === "Identifier" &&
          token.startOffset <= offset &&
          offset < token.startOffset + token.image.length,
      );
      return token
        ? display(symbol.name, symbol.type, {
            ...node.span,
            start: token.startOffset,
            end: token.startOffset + token.image.length,
          })
        : null;
    }
    if (["Identifier", "Parameter"].includes(node.kind) && contains(node.span))
      return display(symbol.name, symbol.type, node.span);
  }
  for (const scope of module.model.scopes)
    for (const symbol of scope.symbols.values()) {
      if (symbol.kind === "import") continue;
      const span = symbolSpan(project, path, symbol);
      if (span && contains(span))
        return display(symbol.name, symbol.type, span);
    }
  // Unresolved host references still have an explicit gradual Any type.
  for (const [raw, type] of module.model.types) {
    const node = raw as Expression;
    if (node.kind === "Identifier" && contains(node.span))
      return display(node.name, type, node.span);
  }
  return null;
}
