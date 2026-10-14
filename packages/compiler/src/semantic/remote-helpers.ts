import type * as A from "../syntax/ast.js";
import type { FunctionType, SemanticModel } from "./types.js";

/** Private, directly called helpers only: exported/escaped/decorated functions are not specialized. */
export function localHelpers(program: A.Program, model: SemanticModel) {
  const calls = new Map<A.Node, A.Call[]>();
  const parents = new Map<A.Node, A.Node>();
  function visit(value: unknown, parent?: A.Node) {
    if (!value || typeof value !== "object") return;
    const node = value as A.Node & { kind?: string };
    if (node.kind && parent) parents.set(node, parent);
    for (const child of Object.values(value)) {
      if (Array.isArray(child))
        child.forEach((item) => visit(item, node.kind ? node : parent));
      else visit(child, node.kind ? node : parent);
    }
  }
  visit(program);
  for (const info of model.functions) {
    const fn = info.node as A.FunctionDeclaration;
    if (fn.kind !== "FunctionDeclaration") continue;
    const symbol = model.bindings.get(fn);
    if (!symbol || [...model.exports.values()].includes(symbol)) continue;
    const declarationParent = parents.get(fn) as
      A.DecoratedFunction | undefined;
    if (
      declarationParent?.kind === "DecoratedFunction" &&
      declarationParent.decorators.some(
        (d) =>
          model.bindings.get(d)?.kind !== "builtin" ||
          !["params", "returns", "check", "describe"].includes(
            d.name.join("."),
          ),
      )
    )
      continue;
    const uses: A.Call[] = [];
    let escaped = false;
    for (const [node, binding] of model.bindings) {
      if (binding !== symbol || node === fn || node === declarationParent)
        continue;
      const parent = parents.get(node) as A.Call | undefined;
      if (
        parent?.kind === "Call" &&
        parent.callee === node &&
        (node as A.Expression).kind === "Identifier"
      )
        uses.push(parent);
      else {
        escaped = true;
        break;
      }
    }
    if (!escaped && uses.length) calls.set(fn, uses);
  }
  return calls;
}

export function remoteParameterHints(program: A.Program, model: SemanticModel) {
  const hints = new Map<A.Node, ReadonlyMap<number, FunctionType>>();
  for (const [node, calls] of localHelpers(program, model)) {
    const fn = node as A.FunctionDeclaration;
    const parameters = new Map<number, FunctionType>();
    for (let index = 0; index < fn.parameters.length; index++) {
      const types = calls.map((call) =>
        model.types.get(
          call.arguments.filter(
            (arg) => !(arg.kind === "Group" && arg.expression === null),
          )[index]!,
        ),
      );
      const first = types[0];
      if (
        first?.kind === "Callable" &&
        first.remote &&
        types.every(
          (type) =>
            type?.kind === "Callable" &&
            JSON.stringify(type.remote) === JSON.stringify(first.remote),
        )
      )
        parameters.set(index, first);
    }
    if (parameters.size) hints.set(node, parameters);
  }
  return hints;
}
