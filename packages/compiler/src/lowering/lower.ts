import type { ParallelTarget } from "../parallel.js";
import { externalImport } from "../modules.js";
import type { Diagnostic } from "../index.js";
import type * as A from "../syntax/ast.js";
import { anyType } from "../semantic/types.js";
import type { SemanticModel, SymbolInfo } from "../semantic/types.js";
import type {
  HelperName,
  IRBinding,
  IRExpression,
  IRModule,
  IRNode,
  IRStatement,
} from "./ir.js";

export type TaskReference = IRBinding | { readonly recordId: string };

export interface LoweringResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly module?: IRModule;
}
interface Value {
  before: IRStatement[];
  value: IRExpression;
}
const helpers = new Set([
  "emitter",
  "range",
  "slice",
  "f",
  "Any",
  "help",
  "describe",
  "returns",
  "params",
  "check",
]);
const nativeBuiltins = new Set(["Number", "String", "Array", "Function"]);

/** Unsupported forms produce diagnostics, never partially runnable output. */
export function lower(
  program: A.Program,
  model: SemanticModel,
  importPaths: ReadonlyMap<A.ImportDeclaration, string> = new Map(),
  parallelTargets: ReadonlyMap<A.Node, ParallelTarget> = new Map(),
  taskReferences: ReadonlyMap<A.Node, TaskReference> = new Map(),
  bindingIds: ReadonlyMap<number, number> = new Map(),
  remoteAliases: ReadonlySet<A.Node> = new Set(),
): LoweringResult {
  const diagnostics: Diagnostic[] = [];
  const bindings = new Map<number, IRBinding>();
  const base = (node: A.Node): IRNode => ({
    span: node.span,
    type: model.types.get(node) ?? anyType,
  });
  const binding = (symbol: SymbolInfo): IRBinding => {
    if (!bindings.has(symbol.id))
      bindings.set(symbol.id, {
        id: bindingIds.get(symbol.id) ?? symbol.id,
        name: symbol.name,
        type: symbol.type,
      });
    return bindings.get(symbol.id)!;
  };
  const reference = (node: A.Node, name: string): IRExpression => {
    const imported = taskReferences.get(node);
    if (imported && "recordId" in imported)
      return {
        ...base(node),
        kind: "Call",
        construct: false,
        callee: { ...base(node), kind: "Helper", name: "getRecord" },
        arguments: [
          { ...base(node), kind: "Literal", value: imported.recordId },
        ],
      };
    if (imported)
      return {
        ...base(node),
        kind: "Reference",
        name: imported.name,
        binding: imported,
      };
    const symbol = model.bindings.get(node);
    if (symbol?.kind === "builtin" && helpers.has(name))
      return {
        ...base(node),
        kind: "Helper",
        name: name as HelperName,
      };
    if (symbol?.kind === "builtin" && !nativeBuiltins.has(name))
      unsupported(node, `Runtime builtin ${name}`);
    return {
      ...base(node),
      kind: "Reference",
      name,
      binding:
        symbol &&
        ["variable", "parameter", "function", "type", "import"].includes(
          symbol.kind,
        )
          ? binding(symbol)
          : null,
    };
  };
  const unsupported = (node: A.Node, feature: string) =>
    diagnostics.push({
      code: "KAL4001",
      severity: "error",
      message: `${feature} is not implemented by the JavaScript target yet`,
      span: node.span,
    });
  const empty = (node: A.Node): IRExpression => ({
    ...base(node),
    kind: "Undefined",
  });
  const expr = (node: A.Expression): IRExpression => {
    const lowered = value(node, false);
    if (lowered.before.length)
      unsupported(node, "Binding in this expression context");
    return lowered.value;
  };
  function invoke(
    node: A.Node,
    callee: A.Expression,
    args: readonly IRExpression[],
    before?: IRStatement[],
  ): IRExpression {
    if (callee.kind === "MethodReference") {
      if (!args.length) {
        unsupported(callee, "A method reference without a receiver");
        return empty(node);
      }
      const names: string[] = [];
      let part: A.Expression = callee.property;
      while (part.kind === "Member") {
        names.unshift(part.property);
        part = part.object;
      }
      if (part.kind === "Identifier") names.unshift(part.name);
      let target = args[0]!;
      for (const property of names)
        target = { ...base(callee), kind: "Member", object: target, property };
      return {
        ...base(node),
        kind: "Call",
        callee: target,
        arguments: args.slice(1),
        construct: false,
      };
    }
    return {
      ...base(node),
      kind: "Call",
      callee: before ? callTarget(callee, before) : expr(callee),
      arguments: args,
      construct: model.types.get(callee)?.kind === "TypeValue",
    };
  }
  function callTarget(node: A.Expression, before: IRStatement[]): IRExpression {
    const declarations: IRStatement[] = [];
    const target = argument(node, declarations);
    // Clio puts callee declarations before argument declarations, including
    // a pipe's input. Keep the expression intact to retain method receivers.
    before.unshift(...declarations);
    return target;
  }
  function pipe(
    node: A.Node,
    target: A.Expression,
    input: IRExpression,
    mapped = false,
    before: IRStatement[] = [],
  ): IRExpression {
    if (target.kind === "Await")
      return {
        ...base(node),
        kind: "Await",
        all: target.all,
        argument: pipe(node, target.argument, input, mapped, before),
      };
    if (mapped) {
      const callee = target.kind === "Call" ? target.callee : target;
      const args =
        target.kind === "Call" ? argumentsOf(target.arguments, before) : [];
      const method: string[] = [];
      if (callee.kind === "MethodReference") {
        let part = callee.property;
        while (part.kind === "Member") {
          method.unshift(part.property);
          part = part.object;
        }
        if (part.kind === "Identifier") method.unshift(part.name);
      }
      const hasAwait = (value: unknown): boolean => {
        if (!value || typeof value !== "object") return false;
        if ("kind" in value && value.kind === "Function") return false;
        if ("kind" in value && value.kind === "Await") return true;
        return Object.values(value).some(hasAwait);
      };
      return {
        ...base(node),
        kind: "Map",
        input,
        callee: method.length
          ? null
          : args.length
            ? expr(callee)
            : callTarget(callee, before),
        method: method.length ? method : null,
        arguments: args,
        construct: model.types.get(callee)?.kind === "TypeValue",
        async: hasAwait(input) || args.some(hasAwait),
      };
    }
    if (target.kind === "Call")
      return invoke(
        node,
        target.callee,
        [input, ...argumentsOf(target.arguments, before)],
        before,
      );
    return invoke(node, target, [input], before);
  }
  function argument(node: A.Expression, before: IRStatement[]): IRExpression {
    if (
      node.kind === "Group" &&
      node.expression &&
      !model.functions.some((info) => info.node === node)
    )
      return argument(node.expression, before);
    const lowered = value(node, true);
    before.push(...lowered.before);
    return lowered.value;
  }
  function argumentsOf(
    args: readonly A.Expression[],
    before?: IRStatement[],
  ): IRExpression[] {
    return args
      .filter((arg) => !(arg.kind === "Group" && arg.expression === null))
      .map((arg) => (before ? argument(arg, before) : expr(arg)));
  }
  function functionValue(
    node: A.FunctionDeclaration | A.Group,
    optimize = false,
  ): IRExpression {
    const info = model.functions.find((item) => item.node === node);
    if (!info) {
      unsupported(node, "Function without semantic information");
      return empty(node);
    }
    let body =
      node.kind === "FunctionDeclaration"
        ? block(node.body.body, true)
        : node.expression
          ? statement(node.expression, true)
          : [];
    let tailRecursive = false;
    // Clio's recursiveReturn transformation is independent of needsAsync.
    // Only bare tail calls qualify; an Await wrapper keeps its explicit boundary.
    if (optimize) {
      const self = binding(model.bindings.get(node)!).id;
      const rewrite = (nodes: readonly IRStatement[]): IRStatement[] =>
        nodes.map((item) => {
          if (item.kind === "If")
            return {
              ...item,
              branches: item.branches.map((branch) => ({
                ...branch,
                body: rewrite(branch.body),
              })),
            };
          if (
            item.kind === "Return" &&
            item.value.kind === "Call" &&
            !item.value.construct &&
            item.value.callee.kind === "Reference" &&
            item.value.callee.binding?.id === self
          ) {
            tailRecursive = true;
            return {
              type: item.type,
              span: item.span,
              kind: "TailCall",
              arguments: item.value.arguments,
            };
          }
          return item;
        });
      body = rewrite(body);
    }
    return {
      ...base(node),
      kind: "Function",
      tailRecursive,
      parameters: info.parameters.map(binding),
      body,
      async: info.async,
    };
  }
  function value(node: A.Expression, allowBindings: boolean): Value {
    const before: IRStatement[] = [];
    let result: IRExpression;
    const parallel = parallelTargets.get(node);
    if (parallel && !parallel.preserveValue)
      return {
        before,
        value: { ...base(node), kind: "Parallel", ...parallel },
      };
    if (taskReferences.has(node))
      return { before, value: reference(node, "task") };
    switch (node.kind) {
      case "Literal":
        if (typeof node.value === "number" && !Number.isFinite(node.value)) {
          unsupported(node, "A non-finite numeric literal");
          result = empty(node);
        } else result = { ...base(node), kind: "Literal", value: node.value };
        break;
      case "Identifier":
      case "Parameter":
        result = reference(node, node.name);
        break;
      case "Group":
        result = model.functions.some((info) => info.node === node)
          ? functionValue(node)
          : node.expression
            ? allowBindings
              ? argument(node.expression, before)
              : expr(node.expression)
            : empty(node);
        break;
      case "Array":
      case "Set":
        result = {
          ...base(node),
          kind: node.kind,
          elements: node.elements.map((item) => argument(item, before)),
        };
        break;
      case "Hashmap":
        if (
          node.entries.filter((entry) => entry.key === "__proto__").length > 1
        )
          unsupported(node, "Duplicate __proto__ hashmap entries");
        result = {
          ...base(node),
          kind: "Object",
          entries: node.entries.map((entry) => ({
            key: entry.key,
            value: expr(entry.value),
          })),
        };
        break;
      case "Member":
        if (
          node.property === "parallel" &&
          model.types.get(node.object)?.kind === "Callable"
        )
          unsupported(node, "Parallel function handles");
        result = {
          ...base(node),
          kind: "Member",
          object: argument(node.object, before),
          property: node.property,
        };
        break;
      case "Range":
        result = {
          ...base(node),
          kind: "Call",
          construct: false,
          callee: { ...base(node), kind: "Helper", name: "range" },
          arguments: [node.start, node.end, node.step].map((bound) =>
            bound ? expr(bound) : empty(node),
          ),
        };
        break;
      case "Slice":
        if (!node.indices.length) unsupported(node, "Empty bracket indexing");
        result = {
          ...base(node),
          kind: "Index",
          object: expr(node.object),
          indices: node.indices.map(expr),
        };
        break;
      case "FormattedString": {
        const args: IRExpression[] = [];
        const escapes: Record<string, string> = {
          n: "\n",
          r: "\r",
          t: "\t",
          b: "\b",
          f: "\f",
          v: "\v",
          "0": "\0",
        };
        for (const part of node.parts) {
          if (part.kind === "Interpolation") {
            args.push(
              part.expression
                ? expr(part.expression)
                : { ...base(part), kind: "Literal", value: null },
            );
          } else {
            // Upstream passes every two-character escape as a separate tag argument.
            for (const chunk of part.raw.match(/\\[\s\S]|[^\\]+/g) ?? []) {
              if (/^\\[ux1-9]$/.test(chunk))
                unsupported(part, "This formatted string escape");
              args.push({
                ...base(part),
                kind: "Literal",
                value: chunk.startsWith("\\")
                  ? (escapes[chunk[1]!] ?? chunk.slice(1))
                  : chunk,
              });
            }
          }
        }
        result = invoke(node, node.tag, args);
        break;
      }
      case "Binary":
        if (node.operator === "in") {
          unsupported(node, "Collection membership");
          result = empty(node);
        } else
          result = {
            ...base(node),
            kind: "Binary",
            operator: node.operator,
            left:
              node.operator === "and" || node.operator === "or"
                ? expr(node.left)
                : argument(node.left, before),
            right:
              node.operator === "and" || node.operator === "or"
                ? expr(node.right)
                : argument(node.right, before),
          };
        break;
      case "Unary":
        result = { ...base(node), kind: "Not", argument: expr(node.argument) };
        break;
      case "Comparison":
        result = {
          ...base(node),
          kind: "Comparison",
          operands: node.operands.map(expr),
          operators: node.operators.map((operator) =>
            operator === "==" ? "===" : operator,
          ),
        };
        break;
      case "Call":
        result = invoke(
          node,
          node.callee,
          argumentsOf(node.arguments, before),
          before,
        );
        break;
      case "Await":
        result = {
          ...base(node),
          kind: "Await",
          argument: expr(node.argument),
          all: node.all,
        };
        break;
      case "Pipeline": {
        const input = value(node.input, allowBindings);
        before.push(...input.before);
        result = pipe(node, node.target, input.value, node.map, before);
        break;
      }
      case "Assignment": {
        if (!allowBindings) {
          unsupported(node, "Binding inside an expression");
          result = empty(node);
          break;
        }
        const assigned = value(node.value, true);
        before.push(...assigned.before);
        if (node.target.kind === "Identifier") {
          const symbol = model.bindings.get(node.target);
          if (!symbol) {
            unsupported(node, "Unresolved assignment binding");
            result = empty(node);
            break;
          }
          before.push({
            ...base(node),
            kind: "Bind",
            binding: binding(symbol),
            value: assigned.value,
          });
          result = reference(node.target, node.target.name);
        } else if (
          node.target.kind === "Member" ||
          node.target.kind === "Slice"
        ) {
          before.push({
            ...base(node),
            kind: "Effect",
            value: {
              ...base(node),
              kind: "Store",
              target: expr(node.target),
              value: assigned.value,
            },
          });
          result = expr(node.target);
        } else {
          unsupported(node, "This assignment target");
          result = empty(node);
        }
        break;
      }
      default:
        unsupported(
          node,
          {
            ParallelReference: "Parallel execution",
            MethodReference: "Standalone method references",
          }[node.kind],
        );
        result = empty(node);
    }
    return { before, value: result };
  }
  function statement(node: A.Statement, tail: boolean): IRStatement[] {
    if (remoteAliases.has(node)) return [];
    switch (node.kind) {
      case "DecoratedFunction": {
        const fn = node.declaration;
        let decorated = functionValue(fn, true);
        for (const decorator of [...node.decorators].reverse()) {
          let callee = reference(decorator, decorator.name[0]!);
          for (const property of taskReferences.has(decorator)
            ? []
            : decorator.name.slice(1))
            callee = {
              ...base(decorator),
              kind: "Member",
              object: callee,
              property,
            };
          decorated = {
            ...base(decorator),
            kind: "Call",
            construct: false,
            callee,
            arguments: [...argumentsOf(decorator.arguments), decorated],
          };
        }
        const declaration: IRStatement = {
          ...base(node),
          kind: "Bind",
          binding: binding(model.bindings.get(fn)!),
          value: decorated,
        };
        return tail
          ? [
              declaration,
              { ...base(node), kind: "Return", value: reference(fn, fn.name) },
            ]
          : [declaration];
      }
      case "FunctionDeclaration": {
        const symbol = model.bindings.get(node)!;
        const declaration: IRStatement = {
          ...base(node),
          kind: "Bind",
          binding: binding(symbol),
          value: functionValue(node, true),
        };
        return tail
          ? [
              declaration,
              {
                ...base(node),
                kind: "Return",
                value: reference(node, node.name),
              },
            ]
          : [declaration];
      }
      case "TypeDeclaration":
      case "ListDeclaration": {
        const symbol = model.bindings.get(node)!;
        const result: IRExpression =
          node.kind === "ListDeclaration"
            ? {
                ...base(node),
                kind: "Array",
                elements: [expr(node.memberType)],
              }
            : {
                ...base(node),
                kind: "Class",
                ...(symbol.type.kind === "TypeValue" &&
                symbol.type.instance.kind === "Named" &&
                symbol.type.instance.taskRecord
                  ? { recordId: symbol.type.instance.id }
                  : {}),
                name: node.name,
                parent: node.parent ? expr(node.parent) : null,
                fields: node.members.map((member) =>
                  member.name.kind === "Identifier" ? member.name.name : "",
                ),
              };
        return [
          {
            ...base(node),
            kind: "Bind",
            binding: binding(symbol),
            value: result,
          },
          ...(tail
            ? [
                {
                  ...base(node),
                  kind: "Return" as const,
                  value: reference(node, node.name),
                },
              ]
            : []),
        ];
      }
      case "Conditional":
        return [
          {
            ...base(node),
            kind: "If",
            branches: node.branches.map((branch) => ({
              condition: branch.condition ? expr(branch.condition) : null,
              body: block(branch.body.body, tail),
            })),
          },
        ];
      case "ExportDeclaration": {
        const statements = statement(node.declaration, false);
        const target =
          node.declaration.kind === "Assignment"
            ? node.declaration.target
            : node.declaration.kind === "DecoratedFunction"
              ? node.declaration.declaration
              : node.declaration;
        if (
          target.kind !== "Identifier" &&
          target.kind !== "FunctionDeclaration" &&
          target.kind !== "TypeDeclaration" &&
          target.kind !== "ListDeclaration"
        ) {
          unsupported(node, "This export declaration");
          return statements;
        }
        // A bare export should read its value only once.
        if (node.declaration.kind === "Identifier") statements.length = 0;
        statements.push({
          ...base(node),
          kind: "Export",
          value: reference(target, target.name),
          name: target.name,
        });
        return statements;
      }
      case "ImportDeclaration": {
        const external = externalImport(node.path);
        const path =
          importPaths.get(node) ??
          (program.body.includes(node) ? external?.specifier : undefined);
        if (!path) {
          unsupported(node, "Unresolved or nested module imports");
          return [];
        }
        return [
          {
            ...base(node),
            kind: "Import",
            mode: external?.kind ?? "local",
            path,
            bindings: node.items.length
              ? node.items.map((item) => ({
                  imported: item.name,
                  binding: binding(model.bindings.get(item)!),
                }))
              : [
                  {
                    imported: external?.kind === "esm" ? "default" : "*",
                    binding: binding(model.bindings.get(node)!),
                  },
                ],
          },
        ];
      }
      default: {
        const result = value(node, true);
        if (node.kind === "Assignment" && !tail) return result.before;
        return [
          ...result.before,
          {
            ...base(node),
            kind: tail ? "Return" : "Effect",
            value: result.value,
          },
        ];
      }
    }
  }
  function block(body: readonly A.Statement[], tail: boolean): IRStatement[] {
    return body.flatMap((node, index) =>
      statement(node, tail && index === body.length - 1),
    );
  }
  const body = block(program.body, false);
  const reservedNames = new Set<string>();
  const collectNames = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if ("name" in value && typeof value.name === "string")
      reservedNames.add(value.name);
    if (
      "kind" in value &&
      value.kind === "Decorator" &&
      "name" in value &&
      Array.isArray(value.name)
    )
      for (const part of value.name)
        if (typeof part === "string") reservedNames.add(part);
    for (const child of Object.values(value)) collectNames(child);
  };
  collectNames(program);
  return diagnostics.length
    ? { diagnostics }
    : {
        diagnostics,
        module: {
          kind: "Module",
          span: program.span,
          body,
          reservedNames: [...reservedNames],
        },
      };
}
