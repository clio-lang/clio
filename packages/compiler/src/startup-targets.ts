import type * as A from "./syntax/ast.js";
import type { SemanticModel, SymbolInfo } from "./semantic/types.js";
import { isTaskType } from "./parallel-types.js";

/** Lift only a single, statically initialized closure with an effect-free factory body.
 * Keep the real closure for ordinary execution; workers receive code plus typed captures.
 */
export function startupTargets(program: A.Program, model: SemanticModel) {
  const links: { binding: A.Assignment; target: A.FunctionDeclaration }[] = [];
  const body: A.Statement[] = [];
  const used = new Set(
    model.scopes.flatMap((scope) => [...scope.symbols.keys()]),
  );
  function walk(
    value: unknown,
    visit: (node: A.Node & { kind: string }) => void,
  ) {
    if (!value || typeof value !== "object") return;
    if ("kind" in value && "span" in value)
      visit(value as A.Node & { kind: string });
    for (const child of Object.values(value)) walk(child, visit);
  }
  walk(program, (node) => {
    if ("name" in node && typeof node.name === "string") used.add(node.name);
  });
  let serial = 0;
  const fresh = () => {
    let name: string;
    do name = `__startup${serial++}`;
    while (used.has(name));
    used.add(name);
    return name;
  };
  const unwrap = (node: A.Statement) =>
    node.kind === "DecoratedFunction" ? node.declaration : node;
  const factories = new Map<SymbolInfo, A.Statement>();
  for (const statement of program.body) {
    const fn = unwrap(statement);
    if (fn.kind === "FunctionDeclaration")
      factories.set(model.bindings.get(fn)!, statement);
  }
  for (const statement of program.body) {
    const binding =
      statement.kind === "ExportDeclaration"
        ? statement.declaration
        : statement;
    if (
      binding.kind !== "Assignment" ||
      binding.target.kind !== "Identifier" ||
      binding.annotation ||
      binding.value.kind !== "Call" ||
      binding.value.callee.kind !== "Identifier"
    ) {
      body.push(statement);
      continue;
    }
    const call = binding.value;
    const symbol = model.bindings.get(call.callee);
    const outer = symbol && factories.get(symbol);
    const factory = outer && unwrap(outer);
    if (
      !outer ||
      !factory ||
      factory.kind !== "FunctionDeclaration" ||
      factory.body.body.length !== 2
    ) {
      body.push(statement);
      continue;
    }
    const [declaration, result] = factory.body.body;
    const inner = unwrap(declaration!);
    const info = model.functions.find((info) => info.node === factory);
    const params =
      outer.kind === "DecoratedFunction"
        ? outer.decorators.find((d) => d.name.join(".") === "params")
        : undefined;
    const allowedDecorators = (node: A.Statement, names: string[]) =>
      node.kind !== "DecoratedFunction" ||
      node.decorators.every(
        (d) =>
          model.bindings.get(d)?.kind === "builtin" &&
          names.includes(d.name.join(".")) &&
          d.arguments.every(
            (arg) =>
              arg.kind === "Identifier" &&
              model.types.get(arg)?.kind === "TypeValue",
          ),
      );
    const args = call.arguments.filter(
      (arg) => !(arg.kind === "Group" && arg.expression === null),
    );
    const references = [...model.bindings].filter(
      ([node, value]) => value === symbol && node !== factory && node !== outer,
    );
    if (
      inner.kind !== "FunctionDeclaration" ||
      result?.kind !== "Identifier" ||
      model.bindings.get(result) !== model.bindings.get(inner) ||
      !info ||
      info.async ||
      !allowedDecorators(outer, ["params"]) ||
      !allowedDecorators(declaration!, ["params", "returns"]) ||
      references.length !== 1 ||
      references[0]![0] !== call.callee ||
      args.length !== factory.parameters.length ||
      info.parameters.some(
        (parameter, index) =>
          !isTaskType(parameter.type) || !params?.arguments[index],
      )
    ) {
      body.push(statement);
      continue;
    }
    const renamed = new Map<SymbolInfo, string>();
    const captures: A.Assignment[] = info.parameters.map((parameter, index) => {
      const name = fresh();
      renamed.set(parameter, name);
      return {
        kind: "Assignment",
        span: args[index]!.span,
        direction: "equals",
        annotation: params!.arguments[index]!,
        target: { kind: "Identifier", name, span: binding.target.span },
        value: args[index]!,
      };
    });
    const targetName = fresh();
    renamed.set(model.bindings.get(inner)!, targetName);
    function clone(value: any): any {
      if (!value || typeof value !== "object") return value;
      if (Array.isArray(value)) return value.map(clone);
      const copy = Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, clone(child)]),
      );
      const name = renamed.get(model.bindings.get(value)!);
      if (
        name &&
        ["Identifier", "ParallelReference", "FunctionDeclaration"].includes(
          value.kind,
        )
      )
        copy.name = name;
      return copy;
    }
    const lifted = clone(declaration!) as
      A.FunctionDeclaration | A.DecoratedFunction;
    const target = unwrap(lifted) as A.FunctionDeclaration;
    const initialized: A.Assignment = {
      ...binding,
      value: { ...call, arguments: captures.map((capture) => capture.target) },
    };
    body.push(
      ...captures,
      lifted,
      statement.kind === "ExportDeclaration"
        ? { ...statement, declaration: initialized }
        : initialized,
    );
    links.push({ binding: initialized, target });
  }
  return { program: links.length ? { ...program, body } : program, links };
}
