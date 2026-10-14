import { remoteType } from "./remote-imports.js";
import {
  copySchema,
  schemaKey,
  type TaskSchema,
  type WireType,
} from "../../protocol/src/schema.js";
import type { Diagnostic } from "./index.js";
import type * as A from "./syntax/ast.js";
import {
  typeName,
  assignable,
  type SemanticModel,
  type SemanticType,
} from "./semantic/types.js";

type Definition = {
  declaration: A.FunctionDeclaration | A.DecoratedFunction;
  model: SemanticModel;
};

/** A concrete type is required at every value crossing the task boundary. */
export function isTaskType(type: SemanticType | undefined): boolean {
  if (!type) return false;
  switch (type.kind) {
    case "Number":
    case "String":
    case "Boolean":
    case "Null":
    case "Void":
      return true;
    case "Named":
      return (
        type.taskRecord === true && [...type.fields.values()].every(isTaskType)
      );
    case "Array":
      return isTaskType(type.element);
    case "Union":
      return type.members.length > 0 && type.members.every(isTaskType);
    default:
      return false;
  }
}
export function taskWireType(type: SemanticType): WireType {
  switch (type.kind) {
    case "Number":
      return "number";
    case "String":
      return "string";
    case "Boolean":
      return "boolean";
    case "Null":
      return "null";
    case "Void":
      return "void";
    case "Named":
      return {
        record: {
          id: type.id,
          fields: [...type.fields].map(
            ([name, field]) => [name, taskWireType(field)] as const,
          ),
        },
      };
    case "Array":
      return { array: taskWireType(type.element) };
    case "Union":
      return { union: type.members.map(taskWireType) };
    default:
      throw new TypeError(`No wire type for ${typeName(type)}`);
  }
}
const awaited = (type: SemanticType | undefined): SemanticType | undefined =>
  type?.kind === "Promise" ? awaited(type.element) : type;

export function validateParallelTypes(
  program: A.Program,
  model: SemanticModel,
  targets: ReadonlyMap<A.Node, unknown>,
  definitionOf: (node: A.Node, owner: SemanticModel) => Definition | undefined,
  onSchema: (callee: A.Expression, schema: TaskSchema) => void,
  capturesOf: (callee: A.Expression) => readonly {
    node: A.Expression;
    model: SemanticModel;
    name: string;
  }[] = () => [],
  exported: readonly {
    definition: Definition;
    captures?: ReturnType<typeof capturesOf>;
    onSchema(schema: TaskSchema): void;
  }[] = [],
  localRemoteValues: ReadonlySet<A.Node> = new Set(),
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const consumed = new Set<A.Node>();
  const handles = new Set<A.Node>();
  const error = (node: A.Node, message: string) =>
    diagnostics.push({
      code: "KAL4202",
      severity: "error",
      span: node.span,
      message,
    });
  const check = (
    node: A.Node,
    type: SemanticType | undefined,
    label: string,
  ) => {
    if (!isTaskType(type))
      error(
        node,
        `${label} has no supported static task type (${type ? typeName(type) : "unknown"}); annotate or convert it before the parallel call`,
      );
  };
  const arbitrary = (definition: Definition) =>
    definition.declaration.kind === "DecoratedFunction" &&
    definition.declaration.decorators.some(
      (d) =>
        definition.model.bindings.get(d)?.kind !== "builtin" ||
        d.name.length !== 1 ||
        !["params", "returns", "check", "describe"].includes(d.name[0]!),
    );
  // Follow value-producing expressions so annotations cannot launder Any into a schema.
  function dynamic(
    node: A.Node | undefined,
    owner: SemanticModel,
    seen = new Set<A.Node>(),
  ): boolean {
    if (!node || seen.has(node)) return false;
    seen.add(node);
    const value = node as A.Statement | A.Block;
    if (!isTaskType(awaited(owner.types.get(node)))) return true;
    switch (value.kind) {
      case "Block":
        return dynamic(value.body.at(-1), owner, seen);
      case "Conditional":
        return value.branches.some((b) => dynamic(b.body, owner, seen));
      case "Assignment":
        return dynamic(value.value, owner, seen);
      case "Identifier": {
        const symbol = owner.bindings.get(node);
        if (!symbol) return false;
        const aliases = (
          expression: A.Expression,
          visited = new Set<A.Node>(),
        ): boolean => {
          if (visited.has(expression)) return false;
          visited.add(expression);
          if (expression.kind === "Member" || expression.kind === "Slice")
            return aliases(expression.object, visited);
          if (expression.kind === "Group")
            return (
              !!expression.expression && aliases(expression.expression, visited)
            );
          const binding = owner.bindings.get(expression);
          if (!binding) return false;
          if (binding === symbol) return true;
          for (const candidate of owner.types.keys()) {
            const assignment = candidate as A.Assignment;
            if (
              assignment.kind === "Assignment" &&
              owner.bindings.get(assignment.target) === binding &&
              aliases(assignment.value, visited)
            )
              return true;
          }
          return false;
        };
        for (const candidate of owner.types.keys()) {
          const assignment = candidate as A.Assignment;
          if (
            assignment.kind === "Assignment" &&
            (assignment.target.kind === "Member" ||
              assignment.target.kind === "Slice") &&
            aliases(assignment.target.object) &&
            dynamic(assignment.value, owner, seen)
          )
            return true;
          if (
            assignment.kind === "Assignment" &&
            owner.bindings.get(assignment.target) === symbol &&
            dynamic(assignment.value, owner, seen)
          )
            return true;
        }
        return false;
      }
      case "Group":
        return dynamic(value.expression ?? undefined, owner, seen);
      case "Await":
        return dynamic(value.argument, owner, seen);
      case "Array":
        return value.elements.some((e) => dynamic(e, owner, seen));
      case "Slice":
        return dynamic(value.object, owner, seen);
      case "Binary":
        return (
          dynamic(value.left, owner, seen) || dynamic(value.right, owner, seen)
        );
      case "Pipeline": {
        const target =
          value.target.kind === "Await" ? value.target.argument : value.target;
        const callee = target.kind === "Call" ? target.callee : target;
        const definition = definitionOf(callee, owner);
        if (!definition) return dynamic(value.input, owner, seen);
        const fn =
          definition.declaration.kind === "DecoratedFunction"
            ? definition.declaration.declaration
            : definition.declaration;
        return (
          arbitrary(definition) ||
          dynamic(value.input, owner, seen) ||
          (target.kind === "Call" &&
            target.arguments.some((arg) => dynamic(arg, owner, seen))) ||
          dynamic(fn.body, definition.model, seen)
        );
      }
      case "Member":
        return (
          owner.types.get(value.object)?.kind === "Named" &&
          dynamic(value.object, owner, seen)
        );
      case "Call": {
        if (
          owner.types.get(value.callee)?.kind === "TypeValue" &&
          owner.types.get(value)?.kind === "Named"
        )
          return value.arguments.some(
            (arg) =>
              !(arg.kind === "Group" && arg.expression === null) &&
              dynamic(arg, owner, seen),
          );
        const definition = definitionOf(value.callee, owner);
        if (!definition) return false;
        const fn =
          definition.declaration.kind === "DecoratedFunction"
            ? definition.declaration.declaration
            : definition.declaration;
        return (
          arbitrary(definition) ||
          value.arguments
            .filter((arg) => !(arg.kind === "Group" && arg.expression === null))
            .some((arg, index) => {
              const signature = definition.model.bindings.get(fn)?.type;
              const expected =
                signature?.kind === "Callable"
                  ? remoteType(signature.parameters[index])?.remote
                  : undefined;
              const actual = remoteType(owner.types.get(arg))?.remote;
              // This is a local helper argument, not a value crossing the task boundary.
              if (
                expected &&
                actual &&
                JSON.stringify(expected) === JSON.stringify(actual)
              )
                return false;
              return dynamic(arg, owner, seen);
            }) ||
          dynamic(fn.body, definition.model, seen)
        );
      }
      default:
        return false;
    }
  }
  const proven = (node: A.Expression) =>
    dynamic(node, model) ? undefined : model.types.get(node);
  function invoke(
    node: A.Node,
    callee: A.Expression,
    args: readonly (SemanticType | undefined)[],
    mapped = false,
  ) {
    handles.add(callee);
    const remote = remoteType(model.types.get(callee));
    if (remote?.remote) {
      const before = diagnostics.length;
      const contract = remote.remote;
      args.forEach((type, index) => {
        check(node, type, `Remote argument ${index + 1}`);
        const expected = remote.parameters[index];
        if (type && expected && !assignable(type, expected))
          error(
            node,
            `Remote argument ${index + 1} has type ${typeName(type)}; expected ${typeName(expected)}`,
          );
      });
      if (args.length < remote.parameters.length)
        error(node, "Remote call is missing required arguments");
      if (diagnostics.length === before) {
        try {
          const schema = copySchema({
            args: args.map(
              (type, index) =>
                contract.signature.args[index] ??
                (mapped &&
                index === args.length - 1 &&
                contract.signature.args[0]
                  ? { array: contract.signature.args[0] }
                  : taskWireType(type!)),
            ),
            result: contract.signature.result,
          });
          if (!contract.schemas.includes(schemaKey(schema)))
            error(
              node,
              "Remote call shape is not registered by its client contract (including map callback metadata)",
            );
          else onSchema(callee, schema);
        } catch (cause) {
          error(node, `Remote schema is unsupported: ${String(cause)}`);
        }
      }
      return;
    }
    const target = callee.kind === "Member" ? callee.object : callee;
    const definition = definitionOf(target, model);
    if (!definition) return; // Target identity diagnostics are reported by task extraction.
    validateDefinition(node, definition, args, capturesOf(callee), (schema) =>
      onSchema(callee, schema),
    );
  }
  function validateDefinition(
    node: A.Node,
    definition: Definition,
    args: readonly (SemanticType | undefined)[],
    captures: ReturnType<typeof capturesOf>,
    accept: (schema: TaskSchema) => void,
  ) {
    const before = diagnostics.length;
    const declaration = definition.declaration;
    const fn =
      declaration.kind === "DecoratedFunction"
        ? declaration.declaration
        : declaration;
    const signature = definition.model.bindings.get(fn)?.type;
    if (signature?.kind !== "Callable") {
      error(node, "Parallel target has no statically known function signature");
      return;
    }
    if (arbitrary(definition))
      error(
        node,
        `Parallel target ${fn.name} uses an arbitrary decorator whose serialized signature cannot be proven`,
      );
    signature.parameters.forEach((type, index) =>
      check(
        node,
        type,
        `Parallel parameter ${fn.parameters[index] ?? index + 1}`,
      ),
    );
    check(node, awaited(signature.returns), `Parallel result of ${fn.name}`);
    // An annotation alone must not conceal a dynamic return expression.
    check(
      node,
      dynamic(fn.body, definition.model)
        ? undefined
        : awaited(definition.model.types.get(fn.body)),
      `Parallel return expression of ${fn.name}`,
    );
    for (const capture of captures)
      check(
        node,
        dynamic(capture.node, capture.model)
          ? undefined
          : capture.model.types.get(capture.node),
        `Parallel capture ${capture.name}`,
      );
    args.forEach((type, index) => {
      check(node, type, `Parallel argument ${index + 1}`);
      const expected = signature.parameters[index];
      if (type && expected && !assignable(type, expected))
        error(
          node,
          `Parallel argument ${index + 1} has type ${typeName(type)}; expected ${typeName(expected)}`,
        );
    });
    if (args.length < signature.parameters.length)
      error(node, `Parallel call to ${fn.name} is missing required arguments`);
    if (diagnostics.length === before) {
      try {
        accept(
          copySchema({
            args: [
              ...captures.map((capture) =>
                taskWireType(capture.model.types.get(capture.node)!),
              ),
              ...args.map((type) => taskWireType(type!)),
            ],
            result: taskWireType(awaited(signature.returns)!),
          }),
        );
      } catch (cause) {
        error(node, `Parallel schema is unsupported: ${String(cause)}`);
      }
    }
  }
  const argsOf = (args: readonly A.Expression[]) =>
    args
      .filter((arg) => !(arg.kind === "Group" && arg.expression === null))
      .map(proven);
  function walk(value: unknown): void {
    if (!value || typeof value !== "object") return;
    const node = value as A.Expression;
    if (node.kind === "Pipeline") {
      const target =
        node.target.kind === "Await" ? node.target.argument : node.target;
      const callee = target.kind === "Call" ? target.callee : target;
      if (targets.has(callee)) {
        if (target.kind === "Call") consumed.add(target);
        const input = proven(node.input);
        const args = target.kind === "Call" ? argsOf(target.arguments) : [];
        if (node.map) {
          check(node, input, "Parallel map collection");
          invoke(
            node,
            callee,
            [
              input?.kind === "Array" ? input.element : undefined,
              ...args,
              { kind: "Number" },
              input,
            ],
            true,
          );
        } else invoke(node, callee, [input, ...args]);
      }
    } else if (
      node.kind === "Call" &&
      !consumed.has(node) &&
      targets.has(node.callee)
    ) {
      invoke(node, node.callee, argsOf(node.arguments));
    }
    for (const child of Object.values(value)) walk(child);
  }
  walk(program);
  for (const service of exported) {
    const { declaration, model: owner } = service.definition;
    const fn =
      declaration.kind === "DecoratedFunction"
        ? declaration.declaration
        : declaration;
    const signature = owner.bindings.get(fn)?.type;
    validateDefinition(
      fn,
      service.definition,
      signature?.kind === "Callable" ? signature.parameters : [],
      service.captures ?? [],
      service.onSchema,
    );
  }
  for (const node of targets.keys())
    if (
      !handles.has(node) &&
      localRemoteValues.has(node) &&
      remoteType(model.types.get(node))?.remote
    ) {
      onSchema(
        node as A.Expression,
        remoteType(model.types.get(node))!.remote!.signature,
      );
    } else if (!handles.has(node))
      error(
        node,
        "Parallel handles must be called directly or used as a pipeline target so their serialized arguments can be checked",
      );
  return diagnostics;
}
