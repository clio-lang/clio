import {
  tokenize,
  type ProjectResult,
  type Expression,
  type SemanticType,
} from "@kalandra/compiler";
import type { CompletionItem } from "vscode-languageserver";
import { formatType } from "./hover.js";

interface Context {
  text: string;
  start: number;
  end: number;
  prefix: string;
  marker: string;
  member: boolean;
  quick: boolean;
}
/** Repair only the word at the cursor; never change the stored document or diagnostics. */
export function completionContext(
  text: string,
  offset: number,
): Context | null {
  const lexed = tokenize({ path: "completion.kalandra", text });
  if (
    lexed.comments.some(
      ({ span }) => span.start <= offset && offset <= span.end,
    )
  )
    return null;
  if (
    lexed.tokens.some((token) =>
      token.tokenType.name === "FormatText"
        ? token.startOffset <= offset &&
          offset <= (token.endOffset ?? token.startOffset) + 1
        : ["StringLiteral", "NumberLiteral"].includes(token.tokenType.name) &&
          token.startOffset < offset &&
          offset <= (token.endOffset ?? token.startOffset),
    )
  )
    return null;
  let start = offset,
    end = offset;
  while (start > 0 && /[a-z0-9_$]/i.test(text[start - 1]!)) start--;
  while (end < text.length && /[a-z0-9_$]/i.test(text[end]!)) end++;
  const prefix = text.slice(start, offset);
  if (/^[0-9]/.test(text.slice(start, end))) return null;
  const quick = text[start - 1] === "@";
  const member =
    text.slice(0, start).trimEnd().endsWith(".") &&
    !text.slice(0, start).trimEnd().endsWith("..");
  let marker = "__kalandra_completion";
  while (text.includes(marker)) marker += "_";
  return {
    text: text.slice(0, start) + marker + text.slice(end),
    start,
    end,
    prefix,
    marker,
    member,
    quick,
  };
}
export function completionsAt(
  project: ProjectResult,
  path: string,
  context: Context,
): CompletionItem[] {
  const module = project.modules.get(path);
  if (!module) return [];
  const items = new Map<string, CompletionItem>();
  const add = (name: string, type: SemanticType, field = false) => {
    if (
      (field && !/^[a-z_$][a-z0-9_$]*$/i.test(name)) ||
      name === context.marker ||
      !name.startsWith(context.prefix) ||
      items.has(name)
    )
      return;
    items.set(name, {
      label: name,
      kind: field
        ? 5
        : type.kind === "Callable"
          ? 3
          : type.kind === "TypeValue"
            ? 7
            : 6,
      detail: formatType(type),
    });
  };
  if (context.member) {
    for (const [raw] of module.model.types) {
      const node = raw as Expression;
      if (
        node.kind !== "Member" ||
        node.property !== context.marker ||
        node.span.end !== context.start + context.marker.length
      )
        continue;
      const type = module.model.types.get(node.object);
      if (type?.kind === "Named")
        for (const [name, field] of type.fields) add(name, field, true);
    }
  } else {
    const scopes = module.model.scopes
      .filter(
        ({ span }) => span.start <= context.start && context.start < span.end,
      )
      .sort(
        (a, b) =>
          a.span.end - a.span.start - (b.span.end - b.span.start) ||
          b.id - a.id,
      );
    let scope = scopes[0];
    const seen = new Set<string>();
    while (scope) {
      for (const symbol of scope.symbols.values()) {
        if (seen.has(symbol.name)) continue;
        seen.add(symbol.name);
        if (context.quick && scope.kind !== "quick-function") continue;
        if (
          symbol.kind === "variable" &&
          scope.id === scopes[0]?.id &&
          symbol.declaration &&
          symbol.declaration.span.start >= context.start
        )
          continue;
        add(symbol.name, symbol.type);
      }
      if (context.quick && ["function", "quick-function"].includes(scope.kind))
        break;
      scope =
        scope.parent === null
          ? undefined
          : module.model.scopes.find(
              (candidate) => candidate.id === scope!.parent,
            );
    }
  }
  return [...items.values()].sort((a, b) => a.label.localeCompare(b.label));
}
