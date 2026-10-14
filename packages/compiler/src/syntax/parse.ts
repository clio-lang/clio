import type { Diagnostic, SourceFile } from "../index.js";
import type { Expression, Program } from "./ast.js";
import { tokenize } from "./lexer.js";
import { AstVisitor, parser } from "./visitor.js";

export interface ParseResult {
  readonly diagnostics: readonly Diagnostic[];
  /** Present only when lexical and syntax validation succeed. */
  readonly program?: Program;
}

function callable(expression: Expression): boolean {
  switch (expression.kind) {
    case "Identifier":
    case "Parameter":
    case "Member":
    case "Slice":
    case "ParallelReference":
    case "MethodReference":
    case "Group":
    case "Call":
      return true;
    case "Await":
      return callable(expression.argument);
    default:
      return false;
  }
}

/** Structural restrictions; names and types are deliberately unresolved here. */
function validate(program: Program): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const pending: unknown[] = [program];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    const node = value as Expression;
    let message: string | undefined;
    if (node.kind === "Call" && !callable(node.callee))
      message = "Expected a callable expression";
    if (node.kind === "Pipeline" && !callable(node.target))
      message = "Expected a callable pipeline target";
    if (
      node.kind === "Assignment" &&
      !["Identifier", "Member", "Slice"].includes(node.target.kind)
    )
      message = "Expected an assignment target";
    const statement = value as Program["body"][number];
    if (
      statement.kind === "Conditional" &&
      statement.branches
        .slice(0, -1)
        .some((branch) => branch.condition === null)
    )
      message = "An else branch must be last";
    if (message)
      diagnostics.push({
        code: "KAL2002",
        severity: "error",
        message,
        span: node.span,
      });
    pending.push(...Object.values(value));
  }
  return diagnostics.sort((a, b) => a.span!.start - b.span!.start);
}

/** Parse in-memory source synchronously without filesystem or host dependencies. */
export function parse(source: SourceFile): ParseResult {
  const lexed = tokenize(source);
  if (lexed.diagnostics.length) return { diagnostics: lexed.diagnostics };
  parser.input = lexed.tokens;
  const cst = parser.program();
  if (parser.errors.length)
    return {
      diagnostics: parser.errors.map((error): Diagnostic => {
        const start = Number.isFinite(error.token.startOffset)
          ? error.token.startOffset
          : source.text.length;
        const end = Number.isFinite(error.token.endOffset)
          ? error.token.endOffset! + 1
          : start;
        return {
          code: "KAL2001",
          severity: "error",
          message: error.message,
          span: { file: source.path, start, end },
        };
      }),
    };
  const program = new AstVisitor(source, lexed.comments).visit(cst) as Program;
  const diagnostics = validate(program);
  return diagnostics.length ? { diagnostics } : { program, diagnostics };
}
