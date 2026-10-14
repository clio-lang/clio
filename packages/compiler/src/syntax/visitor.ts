import type {
  CstChildrenDictionary,
  CstElement,
  CstNode,
  IToken,
} from "chevrotain";
import type { SourceFile, SourceSpan } from "../index.js";
import type * as A from "./ast.js";
import type { SourceComment } from "./lexer.js";
import { KalandraParser } from "./parser.js";

export const parser = new KalandraParser();
const BaseVisitor = parser.getBaseCstVisitorConstructor();
type Context = CstChildrenDictionary;
const isToken = (value: CstElement): value is IToken => "tokenType" in value;
const children = (ctx: Context, key: string): CstNode[] =>
  (ctx[key] ?? []).filter((value): value is CstNode => !isToken(value));
const tokens = (ctx: Context, key: string): IToken[] =>
  (ctx[key] ?? []).filter(isToken);
const image = (ctx: Context, key: string) => tokens(ctx, key)[0]?.image ?? "";
const has = (ctx: Context, key: string) => Boolean(ctx[key]?.length);
const joinSpan = (a: SourceSpan, b: SourceSpan): SourceSpan => ({
  file: a.file,
  start: a.start,
  end: b.end,
});

/** No evaluation: retain raw spelling and decode only string literal escapes. */
function stringValue(raw: string): string {
  return raw
    .slice(1, -1)
    .replace(
      /\\(u[\da-fA-F]{4}|x[\da-fA-F]{2}|[\s\S])/g,
      (_, escape: string) => {
        const escapes: Record<string, string> = {
          n: "\n",
          r: "\r",
          t: "\t",
          b: "\b",
          f: "\f",
          v: "\v",
          "0": "\0",
        };
        if (escape.length > 1 && (escape[0] === "u" || escape[0] === "x"))
          return String.fromCharCode(parseInt(escape.slice(1), 16));
        return escapes[escape] ?? escape;
      },
    );
}

type Postfix =
  | { kind: "member"; property: string; span: SourceSpan }
  | { kind: "slice"; indices: A.Expression[]; span: SourceSpan }
  | {
      kind: "format";
      parts: (A.StringPart | A.Interpolation)[];
      span: SourceSpan;
    };
type Flow =
  | { kind: "pipe"; target: A.Expression; map: boolean; span: SourceSpan }
  | { kind: "assignment"; target: A.Expression; span: SourceSpan };

export class AstVisitor extends BaseVisitor {
  constructor(
    private readonly source: SourceFile,
    private readonly comments: SourceComment[],
  ) {
    super();
    this.validateVisitor();
  }
  private span(ctx: Context): SourceSpan {
    const bounds = Object.values(ctx)
      .flat()
      .map((child) =>
        isToken(child)
          ? [child.startOffset, (child.endOffset ?? child.startOffset - 1) + 1]
          : [
              child.location?.startOffset ?? NaN,
              (child.location?.endOffset ?? NaN) + 1,
            ],
      );
    const starts = bounds.map((bound) => bound[0]!).filter(Number.isFinite);
    const ends = bounds.map((bound) => bound[1]!).filter(Number.isFinite);
    return {
      file: this.source.path,
      start: starts.length ? Math.min(...starts) : this.source.text.length,
      end: ends.length ? Math.max(...ends) : this.source.text.length,
    };
  }
  private values<R>(ctx: Context, key: string): R[] {
    return children(ctx, key).map((node) => this.visit(node) as R);
  }
  private one<R>(ctx: Context, key: string): R {
    return this.visit(children(ctx, key)[0]!) as R;
  }
  expression(ctx: Context): A.Expression {
    if (!has(ctx, "Assign")) return this.one(ctx, "membershipExpression");
    const first = this.one<A.Expression>(ctx, "targetOrType");
    return {
      kind: "Assignment",
      target: has(ctx, "target") ? this.one(ctx, "target") : first,
      annotation: has(ctx, "target") ? first : null,
      value: this.one(ctx, "value"),
      direction: "equals",
      span: this.span(ctx),
    };
  }
  program(ctx: Context): A.Program {
    return {
      kind: "Program",
      body: this.values(ctx, "statement"),
      comments: this.comments,
      span: { file: this.source.path, start: 0, end: this.source.text.length },
    };
  }
  statement(ctx: Context): A.Statement {
    const child = Object.values(ctx)
      .flat()
      .find((node): node is CstNode => !isToken(node))!;
    const declaration = this.visit(child) as A.Statement;
    return has(ctx, "Export")
      ? { kind: "ExportDeclaration", declaration, span: this.span(ctx) }
      : declaration;
  }
  functionDeclaration(ctx: Context): A.FunctionDeclaration {
    return {
      kind: "FunctionDeclaration",
      name: image(ctx, "name"),
      parameters: tokens(ctx, "parameter").map((token) => token.image),
      body: this.one(ctx, "body"),
      span: this.span(ctx),
    };
  }
  body(ctx: Context): A.Block {
    return {
      kind: "Block",
      body: this.values(ctx, "statement"),
      span: this.span(ctx),
    };
  }
  conditional(ctx: Context): A.Conditional {
    const body = this.one<A.Block>(ctx, "body");
    const condition = this.one<A.Expression>(ctx, "condition");
    return {
      kind: "Conditional",
      branches: [
        {
          kind: "Branch",
          condition,
          body,
          span: joinSpan(condition.span, body.span),
        },
        ...this.values<A.Branch>(ctx, "elseBranch"),
      ],
      span: this.span(ctx),
    };
  }
  elseBranch(ctx: Context): A.Branch {
    return {
      kind: "Branch",
      condition: has(ctx, "condition") ? this.one(ctx, "condition") : null,
      body: this.one(ctx, "body"),
      span: this.span(ctx),
    };
  }
  decorator(ctx: Context): A.Decorator {
    return {
      kind: "Decorator",
      name: [
        image(ctx, "Parameter").slice(1),
        ...tokens(ctx, "Identifier").map((token) => token.image),
      ],
      arguments: this.values(ctx, "argument"),
      span: this.span(ctx),
    };
  }
  decoratedFunction(ctx: Context): A.DecoratedFunction | A.ExportDeclaration {
    const declaration: A.DecoratedFunction = {
      kind: "DecoratedFunction",
      declaration: this.one(ctx, "functionDeclaration"),
      decorators: this.values(ctx, "decorator"),
      span: this.span(ctx),
    };
    return has(ctx, "Export")
      ? { kind: "ExportDeclaration", declaration, span: this.span(ctx) }
      : declaration;
  }
  reference(ctx: Context): A.Expression {
    const names = tokens(ctx, "Identifier");
    let result: A.Expression = {
      kind: "Identifier",
      name: names[0]!.image,
      span: {
        file: this.source.path,
        start: names[0]!.startOffset,
        end: names[0]!.endOffset! + 1,
      },
    };
    for (const name of names.slice(1))
      result = {
        kind: "Member",
        object: result,
        property: name.image,
        span: { ...result.span, end: name.endOffset! + 1 },
      };
    return result;
  }
  typeDeclaration(ctx: Context): A.TypeDeclaration {
    const members = has(ctx, "typeMember")
      ? this.values<A.TypeMember>(ctx, "typeMember")
      : this.values<A.Expression>(ctx, "member").map((name): A.TypeMember => ({
          kind: "TypeMember",
          name,
          annotation: null,
          span: name.span,
        }));
    return {
      kind: "TypeDeclaration",
      name: image(ctx, "name"),
      parent: has(ctx, "parent") ? this.one(ctx, "parent") : null,
      members,
      span: this.span(ctx),
    };
  }
  typeMember(ctx: Context): A.TypeMember {
    const refs = this.values<A.Expression>(ctx, "reference");
    return {
      kind: "TypeMember",
      name: refs.at(-1)!,
      annotation: refs.length === 2 ? refs[0]! : null,
      span: this.span(ctx),
    };
  }
  listDeclaration(ctx: Context): A.ListDeclaration {
    return {
      kind: "ListDeclaration",
      name: image(ctx, "name"),
      memberType: this.one(ctx, "reference"),
      span: this.span(ctx),
    };
  }
  importDeclaration(ctx: Context): A.ImportDeclaration {
    return {
      kind: "ImportDeclaration",
      path: stringValue(image(ctx, "StringLiteral")),
      alias: has(ctx, "alias") ? image(ctx, "alias") : null,
      items: this.values(ctx, "importItem"),
      span: this.span(ctx),
    };
  }
  importItem(ctx: Context): A.ImportItem {
    return {
      kind: "ImportItem",
      name: image(ctx, "Identifier") || "*",
      alias: has(ctx, "alias") ? image(ctx, "alias") : null,
      span: this.span(ctx),
    };
  }
  membershipExpression(ctx: Context): A.Expression {
    return this.fold(ctx, "pipelineExpression", ["In"]);
  }
  pipelineExpression(ctx: Context): A.Expression {
    let value = this.one<A.Expression>(ctx, "logicalExpression");
    for (const flow of this.values<Flow>(ctx, "flowTail"))
      value =
        flow.kind === "pipe"
          ? {
              kind: "Pipeline",
              input: value,
              target: flow.target,
              map: flow.map,
              span: joinSpan(value.span, flow.span),
            }
          : {
              kind: "Assignment",
              value,
              target: flow.target,
              annotation: null,
              direction: "flow",
              span: joinSpan(value.span, flow.span),
            };
    return value;
  }
  flowTail(ctx: Context): Flow {
    return has(ctx, "Arrow")
      ? {
          kind: "pipe",
          target: this.one(ctx, "awaitExpression"),
          map: has(ctx, "Star"),
          span: this.span(ctx),
        }
      : {
          kind: "assignment",
          target: this.one(ctx, "postfixExpression"),
          span: this.span(ctx),
        };
  }
  logicalExpression(ctx: Context): A.Expression {
    // Preserve JavaScript's emitted && before || behavior without flattening the AST.
    const values = this.values<A.Expression>(ctx, "awaitExpression");
    const operators = this.operators(ctx, ["And", "Or"]);
    const groups: A.Expression[] = [values[0]!];
    for (let i = 0; i < operators.length; i++) {
      const right = values[i + 1]!;
      if (operators[i]!.image === "and") {
        const left = groups.pop()!;
        groups.push({
          kind: "Binary",
          operator: "and",
          left,
          right,
          span: joinSpan(left.span, right.span),
        });
      } else groups.push(right);
    }
    return groups.slice(1).reduce<A.Expression>(
      (left, right) => ({
        kind: "Binary",
        operator: "or",
        left,
        right,
        span: joinSpan(left.span, right.span),
      }),
      groups[0]!,
    );
  }
  awaitExpression(ctx: Context): A.Expression {
    const argument = this.one<A.Expression>(ctx, "callExpression");
    return has(ctx, "Await") || has(ctx, "AwaitAll")
      ? {
          kind: "Await",
          all: has(ctx, "AwaitAll"),
          argument,
          span: this.span(ctx),
        }
      : argument;
  }
  callExpression(ctx: Context): A.Expression {
    const callee = this.one<A.Expression>(ctx, "notExpression");
    return has(ctx, "argument")
      ? {
          kind: "Call",
          callee,
          arguments: this.values(ctx, "argument"),
          span: this.span(ctx),
        }
      : callee;
  }
  notExpression(ctx: Context): A.Expression {
    const argument = this.one<A.Expression>(ctx, "comparisonExpression");
    return has(ctx, "Not")
      ? { kind: "Unary", operator: "not", argument, span: this.span(ctx) }
      : argument;
  }
  comparisonExpression(ctx: Context): A.Expression {
    const operands = this.values<A.Expression>(ctx, "additiveExpression");
    return operands.length > 1
      ? {
          kind: "Comparison",
          operands,
          operators: this.operators(ctx, [
            "Equal",
            "Greater",
            "GreaterEqual",
            "Less",
            "LessEqual",
          ]).map((token) => token.image),
          span: this.span(ctx),
        }
      : operands[0]!;
  }
  additiveExpression(ctx: Context): A.Expression {
    return this.fold(ctx, "multiplicativeExpression", ["Plus", "Minus"]);
  }
  multiplicativeExpression(ctx: Context): A.Expression {
    return this.fold(ctx, "powerExpression", ["Star", "Slash", "Percent"]);
  }
  powerExpression(ctx: Context): A.Expression {
    const left = this.one<A.Expression>(ctx, "rangeExpression");
    return has(ctx, "Power")
      ? {
          kind: "Binary",
          operator: "**",
          left,
          right: this.one(ctx, "powerExpression"),
          span: this.span(ctx),
        }
      : left;
  }
  private operators(ctx: Context, keys: string[]): IToken[] {
    return keys
      .flatMap((key) => tokens(ctx, key))
      .sort((a, b) => a.startOffset - b.startOffset);
  }
  private fold(
    ctx: Context,
    key: string,
    operatorKeys: string[],
  ): A.Expression {
    const expressions = this.values<A.Expression>(ctx, key),
      operators = this.operators(ctx, operatorKeys);
    return expressions.slice(1).reduce<A.Expression>(
      (left, right, index) => ({
        kind: "Binary",
        operator: operators[index]!.image,
        left,
        right,
        span: joinSpan(left.span, right.span),
      }),
      expressions[0]!,
    );
  }
  rangeExpression(ctx: Context): A.Expression {
    if (!has(ctx, "Range") && !has(ctx, "By")) return this.one(ctx, "start");
    return {
      kind: "Range",
      start: has(ctx, "start") ? this.one(ctx, "start") : null,
      end: has(ctx, "end") ? this.one(ctx, "end") : null,
      step: has(ctx, "step") ? this.one(ctx, "step") : null,
      span: this.span(ctx),
    };
  }
  postfixExpression(ctx: Context): A.Expression {
    let value = this.one<A.Expression>(ctx, "primaryExpression");
    for (const tail of this.values<Postfix>(ctx, "postfixTail")) {
      const span = joinSpan(value.span, tail.span);
      if (tail.kind === "member")
        value = {
          kind: "Member",
          object: value,
          property: tail.property,
          span,
        };
      else if (tail.kind === "slice")
        value = { kind: "Slice", object: value, indices: tail.indices, span };
      else
        value = {
          kind: "FormattedString",
          tag: value,
          parts: tail.parts,
          span,
        };
    }
    return value;
  }
  postfixTail(ctx: Context): Postfix {
    if (has(ctx, "Dot"))
      return {
        kind: "member",
        property: image(ctx, "Identifier"),
        span: this.span(ctx),
      };
    if (has(ctx, "SliceStart"))
      return {
        kind: "slice",
        indices: this.values(ctx, "index"),
        span: this.span(ctx),
      };
    return this.one(ctx, "formattedString");
  }
  primaryExpression(ctx: Context): A.Expression {
    const span = this.span(ctx);
    if (has(ctx, "NumberLiteral")) {
      const raw = image(ctx, "NumberLiteral");
      return {
        kind: "Literal",
        value: Number(raw.replaceAll("_", "")),
        raw,
        span,
      };
    }
    if (has(ctx, "StringLiteral")) {
      const raw = image(ctx, "StringLiteral");
      return { kind: "Literal", value: stringValue(raw), raw, span };
    }
    if (has(ctx, "Pipe"))
      return {
        kind: "ParallelReference",
        name: image(ctx, "Identifier"),
        span,
      };
    if (has(ctx, "Identifier")) {
      const name = image(ctx, "Identifier");
      return ["true", "false", "null"].includes(name)
        ? {
            kind: "Literal",
            value: name === "null" ? null : name === "true",
            raw: name,
            span,
          }
        : { kind: "Identifier", name, span };
    }
    if (has(ctx, "Parameter"))
      return {
        kind: "Parameter",
        name: image(ctx, "Parameter").slice(1),
        span,
      };
    if (has(ctx, "Dot"))
      return {
        kind: "MethodReference",
        property: this.one(ctx, "reference"),
        span,
      };
    if (has(ctx, "LParen"))
      return {
        kind: "Group",
        expression: has(ctx, "expression") ? this.one(ctx, "expression") : null,
        span,
      };
    for (const key of ["arrayLiteral", "setLiteral", "hashmapLiteral"])
      if (has(ctx, key)) return this.one(ctx, key);
    throw new Error("Unexpected primary syntax node");
  }
  arrayLiteral(ctx: Context): A.Collection {
    return {
      kind: "Array",
      elements: this.values(ctx, "notExpression"),
      span: this.span(ctx),
    };
  }
  setLiteral(ctx: Context): A.Collection {
    return {
      kind: "Set",
      elements: this.values(ctx, "notExpression"),
      span: this.span(ctx),
    };
  }
  hashmapLiteral(ctx: Context): A.Hashmap {
    const entries = this.values<A.MapEntry>(ctx, "mapEntry");
    for (const block of this.values<A.Hashmap>(ctx, "mapBlock"))
      entries.push(...block.entries);
    return { kind: "Hashmap", entries, span: this.span(ctx) };
  }
  mapBlock(ctx: Context): A.Hashmap {
    return {
      kind: "Hashmap",
      entries: this.values(ctx, "mapEntry"),
      span: this.span(ctx),
    };
  }
  mapEntry(ctx: Context): A.MapEntry {
    return {
      kind: "MapEntry",
      key: image(ctx, "Identifier"),
      value: has(ctx, "mapBlock")
        ? this.one(ctx, "mapBlock")
        : this.one(ctx, "rangeExpression"),
      span: this.span(ctx),
    };
  }
  formattedString(ctx: Context): Postfix {
    const parts: (A.StringPart | A.Interpolation)[] = tokens(
      ctx,
      "FormatText",
    ).map((token) => ({
      kind: "StringPart",
      raw: token.image,
      span: {
        file: this.source.path,
        start: token.startOffset,
        end: token.endOffset! + 1,
      },
    }));
    parts.push(...this.values<A.Interpolation>(ctx, "interpolation"));
    parts.sort((a, b) => a.span.start - b.span.start);
    return { kind: "format", parts, span: this.span(ctx) };
  }
  interpolation(ctx: Context): A.Interpolation {
    return {
      kind: "Interpolation",
      expression: has(ctx, "expression") ? this.one(ctx, "expression") : null,
      span: this.span(ctx),
    };
  }
}
