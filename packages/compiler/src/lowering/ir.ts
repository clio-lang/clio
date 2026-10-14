import type { TaskSchema } from "../../../protocol/src/schema.js";
export type HelperName =
  | "emitter"
  | "getRecord"
  | "range"
  | "slice"
  | "f"
  | "Any"
  | "help"
  | "describe"
  | "returns"
  | "params"
  | "check";
import type { SourceSpan } from "../index.js";
import type { SemanticType } from "../semantic/types.js";

/** Backend-independent, typed executable subset. No source AST or Babel nodes. */
export interface IRNode {
  readonly span: SourceSpan;
  readonly type: SemanticType;
}
export interface IRBinding {
  readonly id: number;
  readonly name: string;
  readonly type: SemanticType;
}
export interface IRModule {
  readonly kind: "Module";
  readonly span: SourceSpan;
  readonly body: readonly IRStatement[];
  readonly reservedNames: readonly string[];
}
export type IRExpression = IRNode &
  (
    | {
        readonly kind: "Literal";
        readonly value: string | number | boolean | null;
      }
    | {
        readonly kind: "Parallel";
        readonly captures?: readonly string[];
        readonly recordScope?: string;
        readonly schema?: TaskSchema;
        readonly module: string;
        readonly exportName: string;
      }
    | { readonly kind: "Undefined" }
    | { readonly kind: "Helper"; readonly name: HelperName }
    | {
        readonly kind: "Index";
        readonly object: IRExpression;
        readonly indices: readonly IRExpression[];
      }
    | {
        readonly kind: "Map";
        readonly input: IRExpression;
        readonly callee: IRExpression | null;
        readonly method: readonly string[] | null;
        readonly arguments: readonly IRExpression[];
        readonly construct: boolean;
        readonly async: boolean;
      }
    | {
        readonly kind: "Class";
        readonly recordId?: string;
        readonly name: string;
        readonly parent: IRExpression | null;
        readonly fields: readonly string[];
      }
    | {
        readonly kind: "Reference";
        readonly name: string;
        readonly binding: IRBinding | null;
      }
    | {
        readonly kind: "Array" | "Set";
        readonly elements: readonly IRExpression[];
      }
    | {
        readonly kind: "Object";
        readonly entries: readonly {
          readonly key: string;
          readonly value: IRExpression;
        }[];
      }
    | {
        readonly kind: "Member";
        readonly object: IRExpression;
        readonly property: string;
      }
    | {
        readonly kind: "Binary";
        readonly operator: string;
        readonly left: IRExpression;
        readonly right: IRExpression;
      }
    | { readonly kind: "Not"; readonly argument: IRExpression }
    | {
        readonly kind: "Comparison";
        readonly operands: readonly IRExpression[];
        readonly operators: readonly string[];
      }
    | {
        readonly kind: "Call";
        readonly callee: IRExpression;
        readonly arguments: readonly IRExpression[];
        readonly construct: boolean;
      }
    | {
        readonly kind: "Function";
        readonly tailRecursive?: boolean;
        readonly parameters: readonly IRBinding[];
        readonly body: readonly IRStatement[];
        readonly async: boolean;
      }
    | {
        readonly kind: "Await";
        readonly argument: IRExpression;
        readonly all: boolean;
      }
    | {
        readonly kind: "Store";
        readonly target: IRExpression;
        readonly value: IRExpression;
      }
  );
export type IRStatement = IRNode &
  (
    | {
        readonly kind: "Import";
        readonly mode: "local" | "esm" | "cjs";
        readonly path: string;
        readonly bindings: readonly {
          readonly imported: string;
          readonly binding: IRBinding;
        }[];
      }
    | {
        readonly kind: "Bind";
        readonly binding: IRBinding;
        readonly value: IRExpression;
      }
    | { readonly kind: "Effect" | "Return"; readonly value: IRExpression }
    | { readonly kind: "TailCall"; readonly arguments: readonly IRExpression[] }
    | {
        readonly kind: "If";
        readonly branches: readonly {
          readonly condition: IRExpression | null;
          readonly body: readonly IRStatement[];
        }[];
      }
    | {
        readonly kind: "Export";
        readonly value: IRExpression;
        readonly name: string;
      }
  );
