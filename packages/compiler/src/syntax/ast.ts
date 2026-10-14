import type { SourceSpan } from "../index.js";
import type { SourceComment } from "./lexer.js";

export interface Node {
  readonly span: SourceSpan;
}
export interface Program extends Node {
  readonly kind: "Program";
  readonly body: readonly Statement[];
  readonly comments: readonly SourceComment[];
}
export interface Identifier extends Node {
  readonly kind: "Identifier";
  readonly name: string;
}
export interface Parameter extends Node {
  readonly kind: "Parameter";
  readonly name: string;
}
export interface Literal extends Node {
  readonly kind: "Literal";
  readonly value: string | number | boolean | null;
  readonly raw: string;
}
export interface Group extends Node {
  readonly kind: "Group";
  readonly expression: Expression | null;
}
export interface Collection extends Node {
  readonly kind: "Array" | "Set";
  readonly elements: readonly Expression[];
}
export interface MapEntry extends Node {
  readonly kind: "MapEntry";
  readonly key: string;
  readonly value: Expression;
}
export interface Hashmap extends Node {
  readonly kind: "Hashmap";
  readonly entries: readonly MapEntry[];
}
export interface Member extends Node {
  readonly kind: "Member";
  readonly object: Expression;
  readonly property: string;
}
export interface Slice extends Node {
  readonly kind: "Slice";
  readonly object: Expression;
  readonly indices: readonly Expression[];
}
export interface Range extends Node {
  readonly kind: "Range";
  readonly start: Expression | null;
  readonly end: Expression | null;
  readonly step: Expression | null;
}
export interface Binary extends Node {
  readonly kind: "Binary";
  readonly operator: string;
  readonly left: Expression;
  readonly right: Expression;
}
export interface Comparison extends Node {
  readonly kind: "Comparison";
  readonly operands: readonly Expression[];
  readonly operators: readonly string[];
}
export interface Unary extends Node {
  readonly kind: "Unary";
  readonly operator: "not";
  readonly argument: Expression;
}
export interface Call extends Node {
  readonly kind: "Call";
  readonly callee: Expression;
  readonly arguments: readonly Expression[];
}
export interface ParallelReference extends Node {
  readonly kind: "ParallelReference";
  readonly name: string;
}
export interface MethodReference extends Node {
  readonly kind: "MethodReference";
  readonly property: Expression;
}
export interface AwaitExpression extends Node {
  readonly kind: "Await";
  readonly all: boolean;
  readonly argument: Expression;
}
export interface Pipeline extends Node {
  readonly kind: "Pipeline";
  readonly input: Expression;
  readonly target: Expression;
  readonly map: boolean;
}
export interface Assignment extends Node {
  readonly kind: "Assignment";
  readonly target: Expression;
  readonly annotation: Expression | null;
  readonly value: Expression;
  readonly direction: "equals" | "flow";
}
export interface StringPart extends Node {
  readonly kind: "StringPart";
  readonly raw: string;
}
export interface Interpolation extends Node {
  readonly kind: "Interpolation";
  readonly expression: Expression | null;
}
export interface FormattedString extends Node {
  readonly kind: "FormattedString";
  readonly tag: Expression;
  readonly parts: readonly (StringPart | Interpolation)[];
}
export type Expression =
  | Identifier
  | Parameter
  | Literal
  | Group
  | Collection
  | Hashmap
  | Member
  | Slice
  | Range
  | Binary
  | Comparison
  | Unary
  | Call
  | ParallelReference
  | MethodReference
  | AwaitExpression
  | Pipeline
  | Assignment
  | FormattedString;
export interface Block extends Node {
  readonly kind: "Block";
  readonly body: readonly Statement[];
}
export interface FunctionDeclaration extends Node {
  readonly kind: "FunctionDeclaration";
  readonly name: string;
  readonly parameters: readonly string[];
  readonly body: Block;
}
export interface Branch extends Node {
  readonly kind: "Branch";
  readonly condition: Expression | null;
  readonly body: Block;
}
export interface Conditional extends Node {
  readonly kind: "Conditional";
  readonly branches: readonly Branch[];
}
export interface Decorator extends Node {
  readonly kind: "Decorator";
  readonly name: readonly string[];
  readonly arguments: readonly Expression[];
}
export interface DecoratedFunction extends Node {
  readonly kind: "DecoratedFunction";
  readonly declaration: FunctionDeclaration;
  readonly decorators: readonly Decorator[];
}
export interface ExportDeclaration extends Node {
  readonly kind: "ExportDeclaration";
  readonly declaration: Statement;
}
export interface ImportItem extends Node {
  readonly kind: "ImportItem";
  readonly name: string;
  readonly alias: string | null;
}
export interface ImportDeclaration extends Node {
  readonly kind: "ImportDeclaration";
  readonly path: string;
  readonly alias: string | null;
  readonly items: readonly ImportItem[];
}
export interface TypeMember extends Node {
  readonly kind: "TypeMember";
  readonly name: Expression;
  readonly annotation: Expression | null;
}
export interface TypeDeclaration extends Node {
  readonly kind: "TypeDeclaration";
  readonly name: string;
  readonly parent: Expression | null;
  readonly members: readonly TypeMember[];
}
export interface ListDeclaration extends Node {
  readonly kind: "ListDeclaration";
  readonly name: string;
  readonly memberType: Expression;
}
export type Statement =
  | Expression
  | FunctionDeclaration
  | Conditional
  | DecoratedFunction
  | ExportDeclaration
  | ImportDeclaration
  | TypeDeclaration
  | ListDeclaration;
