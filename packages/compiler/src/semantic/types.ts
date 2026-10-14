import type { TaskSchema } from "../../../protocol/src/schema.js";
import type { Node, Program } from "../syntax/ast.js";
import type { Diagnostic, SourceSpan } from "../index.js";

export type PrimitiveName =
  | "Any"
  | "Number"
  | "String"
  | "Boolean"
  | "Null"
  | "Void"
  | "Object"
  | "Function"
  | "Type"
  | "ListType";
export type SemanticType =
  | { readonly kind: PrimitiveName }
  | {
      readonly kind: "Array" | "Set" | "Range" | "Promise";
      readonly element: SemanticType;
    }
  | { readonly kind: "Union"; readonly members: readonly SemanticType[] }
  | FunctionType
  | NamedType
  | TypeValue;
export interface FunctionType {
  readonly remote?: {
    readonly module: string;
    readonly exportName: string;
    readonly recordScope: string;
    readonly signature: TaskSchema;
    readonly schemas: readonly string[];
  };

  readonly kind: "Callable";
  readonly parameters: readonly SemanticType[];
  readonly returns: SemanticType;
  readonly async: boolean;
}
export interface NamedType {
  readonly taskRecord?: boolean;
  readonly kind: "Named";
  readonly id: string;
  readonly name: string;
  readonly fields: ReadonlyMap<string, SemanticType>;
}
export interface TypeValue {
  readonly kind: "TypeValue";
  /** List declarations describe arrays but are not callable constructors. */
  readonly callable?: boolean;
  readonly instance: SemanticType;
  /** null means the constructor signature is not known. */
  readonly parameters: readonly SemanticType[] | null;
}
export interface SymbolInfo {
  readonly id: number;
  readonly name: string;
  readonly kind:
    | "builtin"
    | "external"
    | "import"
    | "variable"
    | "function"
    | "parameter"
    | "type";
  readonly scope: number;
  readonly declaration: Node | null;
  readonly type: SemanticType;
}
export interface ScopeInfo {
  readonly span: SourceSpan;
  readonly id: number;
  readonly parent: number | null;
  readonly kind: "module" | "function" | "block" | "quick-function";
  readonly symbols: ReadonlyMap<string, SymbolInfo>;
}
export interface FunctionInfo {
  readonly node: Node;
  readonly parameters: readonly SymbolInfo[];
  readonly captures: readonly SymbolInfo[];
  readonly async: boolean;
  readonly usesParallel: boolean;
}
export interface AnalysisOptions {
  /** Clio permits unresolved host values. Strict mode turns their warnings into errors. */
  readonly strictNames?: boolean;
  /** Explicit host bindings; no implicit Node/Bun/browser globals. */
  readonly globals?: Readonly<Record<string, SemanticType>>;
  /** Whole CommonJS module.exports values (which may be callable). */
  readonly moduleValues?: Readonly<Record<string, SemanticType>>;
  /** Optional export signatures supplied by a host; this API never loads modules. */
  readonly modules?: Readonly<
    Record<string, Readonly<Record<string, SemanticType>>>
  >;
}
export interface SemanticModel {
  readonly types: ReadonlyMap<Node, SemanticType>;
  readonly bindings: ReadonlyMap<Node, SymbolInfo>;
  readonly scopes: readonly ScopeInfo[];
  readonly functions: readonly FunctionInfo[];
  readonly exports: ReadonlyMap<string, SymbolInfo>;
  readonly imports: readonly string[];
  readonly moduleAsync: boolean;
}
export interface AnalysisResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly program?: Program;
  /** Available for syntactically valid source, including source with semantic errors. */
  readonly model?: SemanticModel;
}
export const anyType: SemanticType = { kind: "Any" };
export function typeName(type: SemanticType): string {
  switch (type.kind) {
    case "Named":
      return type.name;
    case "TypeValue":
      return `Type<${typeName(type.instance)}>`;
    case "Callable":
      return "Function";
    case "Union":
      return type.members.map(typeName).join(" | ");
    case "Array":
    case "Set":
    case "Range":
    case "Promise":
      return `${type.kind}<${typeName(type.element)}>`;
    default:
      return type.kind;
  }
}
export function sameType(a: SemanticType, b: SemanticType): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "Named" && b.kind === "Named") return a.id === b.id;
  if ("element" in a && "element" in b) return sameType(a.element, b.element);
  if (a.kind === "Union" && b.kind === "Union")
    return (
      a.members.length === b.members.length &&
      a.members.every((type) =>
        b.members.some((other) => sameType(type, other)),
      )
    );
  if (a.kind === "TypeValue" && b.kind === "TypeValue")
    return sameType(a.instance, b.instance);
  if (a.kind === "Callable" && b.kind === "Callable")
    return (
      JSON.stringify(a.remote) === JSON.stringify(b.remote) &&
      a.async === b.async &&
      sameType(a.returns, b.returns) &&
      a.parameters.length === b.parameters.length &&
      a.parameters.every((type, index) => sameType(type, b.parameters[index]!))
    );
  return true;
}
export function union(types: readonly SemanticType[]): SemanticType {
  const unique: SemanticType[] = [];
  for (const type of types.flatMap((type) =>
    type.kind === "Union" ? type.members : [type],
  )) {
    if (type.kind === "Any") return anyType;
    if (!unique.some((other) => sameType(type, other))) unique.push(type);
  }
  return unique.length === 0
    ? anyType
    : unique.length === 1
      ? unique[0]!
      : { kind: "Union", members: unique };
}
export function assignable(
  actual: SemanticType,
  expected: SemanticType,
): boolean {
  if (actual.kind === "Any" || expected.kind === "Any") return true;
  if (actual.kind === "Union")
    return actual.members.every((member) => assignable(member, expected));
  if (expected.kind === "Union")
    return expected.members.some((member) => assignable(actual, member));
  if (expected.kind === "Function" && actual.kind === "Callable") return true;
  if (expected.kind === "Type" && actual.kind === "TypeValue")
    return actual.callable !== false;
  if (expected.kind === "ListType" && actual.kind === "TypeValue")
    return actual.callable === false;
  if (
    "element" in expected &&
    "element" in actual &&
    expected.kind === actual.kind
  )
    return assignable(actual.element, expected.element);
  return sameType(actual, expected);
}
