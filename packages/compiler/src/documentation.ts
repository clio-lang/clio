import type { Diagnostic, SourceFile, SourceSpan } from "./index.js";
import { parse } from "./syntax/parse.js";
import { analyzeProgram } from "./semantic/analyze.js";

export interface FunctionDocumentation {
  readonly name: string;
  readonly exported: boolean;
  readonly parameters: readonly string[];
  /** Source declarations, not inferred types or evaluated decorator results. */
  readonly decorators: readonly string[];
  readonly description: string | null;
  readonly descriptionStatus: "literal" | "dynamic" | "none";
  readonly span: SourceSpan;
}

/** Inspect declarations without resolving imports, emitting code or evaluating source. */
export function sourceDocumentation(source: SourceFile): {
  diagnostics: readonly Diagnostic[];
  functions?: readonly FunctionDocumentation[];
} {
  const parsed = parse(source);
  if (!parsed.program) return { diagnostics: parsed.diagnostics };
  // Binding identity distinguishes builtin @describe from a shadowed decorator.
  // Semantic diagnostics are intentionally outside this declaration-only API.
  const { model } = analyzeProgram(parsed.program);
  const functions: FunctionDocumentation[] = [];
  for (const statement of parsed.program.body) {
    const node =
      statement.kind === "ExportDeclaration"
        ? statement.declaration
        : statement;
    const declaration =
      node.kind === "DecoratedFunction" ? node.declaration : node;
    if (declaration.kind !== "FunctionDeclaration") continue;
    const decorators = node.kind === "DecoratedFunction" ? node.decorators : [];
    // The outermost @describe is applied last at runtime.
    const describe = decorators.find(
      (decorator) =>
        decorator.name.length === 1 &&
        decorator.name[0] === "describe" &&
        model?.bindings.get(decorator)?.kind === "builtin",
    );
    const value = describe?.arguments[0];
    const literal =
      describe?.arguments.length === 1 &&
      value?.kind === "Literal" &&
      typeof value.value === "string";
    functions.push({
      name: declaration.name,
      exported:
        model?.exports.has(declaration.name) ??
        statement.kind === "ExportDeclaration",
      parameters: declaration.parameters,
      decorators: decorators.map((decorator) =>
        source.text.slice(decorator.span.start, decorator.span.end).trimEnd(),
      ),
      description: literal ? (value.value as string) : null,
      descriptionStatus: describe ? (literal ? "literal" : "dynamic") : "none",
      span: declaration.span,
    });
  }
  return { diagnostics: parsed.diagnostics, functions };
}
