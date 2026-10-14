import type * as A from "./syntax/ast.js";
import type { SemanticModel } from "./semantic/types.js";
import { isTaskType, taskWireType } from "./parallel-types.js";
import { schemaKey, type TaskSchema } from "../../protocol/src/schema.js";

export interface ServiceCapture {
  key: string;
  path: string;
  symbol: { id: number; name: string };
}

/** Emit a bounded, pure initializer graph. Application modules are never imported. */
export function remoteCaptureBootstrap(
  modules: ReadonlyMap<
    string,
    {
      program: A.Program;
      model: SemanticModel;
      startupBindings?: ReadonlySet<A.Node>;
    }
  >,
  captures: readonly ServiceCapture[],
) {
  const definitions = new Map<
    string,
    { node: A.Assignment; model: SemanticModel; path: string }
  >();
  for (const [path, { program, model }] of modules)
    for (const statement of program.body) {
      const node =
        statement.kind === "ExportDeclaration"
          ? statement.declaration
          : statement;
      if (
        node.kind === "Assignment" &&
        node.annotation &&
        node.target.kind === "Identifier"
      ) {
        const symbol = model.bindings.get(node.target);
        if (symbol?.declaration === node.target)
          definitions.set(JSON.stringify([path, symbol.id]), {
            node,
            model,
            path,
          });
      }
    }
  const recordIds = new Set<string>();
  for (const { program, model } of modules.values())
    for (const statement of program.body) {
      const node =
        statement.kind === "ExportDeclaration"
          ? statement.declaration
          : statement;
      const type =
        node.kind === "TypeDeclaration"
          ? model.bindings.get(node)?.type
          : undefined;
      if (type?.kind === "TypeValue" && type.instance.kind === "Named")
        recordIds.add(type.instance.id);
    }
  const names = new Map<string, string>();
  const visiting = new Set<string>();
  const lines: string[] = [];
  const owners = new Set<string>();
  function initialize(key: string): string {
    if (visiting.has(key)) throw new Error("Remote capture initializer cycle");
    if (names.has(key)) return names.get(key)!;
    const definition = definitions.get(key);
    if (!definition)
      throw new Error(
        "Remote captures require typed module-level initializer dependencies",
      );
    const { node, model, path } = definition;
    if (
      !isTaskType(model.types.get(node.target)) ||
      !isTaskType(model.types.get(node.value))
    )
      throw new Error(
        "Remote capture initializer must have a concrete Sia type",
      );
    visiting.add(key);
    owners.add(path);
    const value = expression(node.value, model, path);
    const name = "c" + names.size;
    names.set(key, name);
    visiting.delete(key);
    lines.push(`const ${name} = ${value};`);
    return name;
  }
  function expression(
    node: A.Expression,
    model: SemanticModel,
    path: string,
  ): string {
    switch (node.kind) {
      case "Literal":
        if (Object.is(node.value, -0)) return "-0";
        return typeof node.value === "number" && !Number.isFinite(node.value)
          ? String(node.value)
          : JSON.stringify(node.value);
      case "Group":
        if (node.expression) return expression(node.expression, model, path);
        break;
      case "Identifier": {
        const symbol = model.bindings.get(node);
        if (symbol) return initialize(JSON.stringify([path, symbol.id]));
        break;
      }
      case "Array":
        return (
          "[" +
          node.elements
            .map((value) => expression(value, model, path))
            .join(",") +
          "]"
        );
      case "Binary":
        if (
          ["+", "-", "*", "/", "%", "**"].includes(node.operator) &&
          [node.left, node.right].every(
            (value) => model.types.get(value)?.kind === "Number",
          )
        )
          return `(${expression(node.left, model, path)} ${node.operator} ${expression(node.right, model, path)})`;
        break;
      case "Unary":
        return `(!${expression(node.argument, model, path)})`;
      case "Call": {
        const type = model.types.get(node.callee);
        if (
          type?.kind === "TypeValue" &&
          type.instance.kind === "Named" &&
          type.instance.taskRecord &&
          recordIds.has(type.instance.id)
        ) {
          const id = type.instance.id;
          return `new (helpers.getRecord(${JSON.stringify(id)}))(${node.arguments
            .filter(
              (value) => !(value.kind === "Group" && value.expression === null),
            )
            .map((value) => expression(value, model, path))
            .join(",")})`;
        }
        break;
      }
    }
    throw new Error(
      `Unsupported remote capture initializer ${node.kind} in ${path}`,
    );
  }
  const values = captures.map((capture) => initialize(capture.key));
  // Conservative first boundary: don't silently omit setup writes or calls.
  for (const path of owners) {
    const { program, model, startupBindings } = modules.get(path)!;
    for (const statement of program.body) {
      const node =
        statement.kind === "ExportDeclaration"
          ? statement.declaration
          : statement;
      if (statement.kind === "ExportDeclaration" && node.kind === "Identifier")
        continue;
      if (node.kind === "DecoratedFunction") {
        for (const decorator of node.decorators) {
          if (
            model.bindings.get(decorator)?.kind !== "builtin" ||
            decorator.name.length !== 1 ||
            !["params", "returns", "check", "describe"].includes(
              decorator.name[0]!,
            ) ||
            decorator.arguments.some(
              (arg) =>
                arg.kind !== "Literal" &&
                !(
                  ["Identifier", "Member"].includes(arg.kind) &&
                  model.types.get(arg)?.kind === "TypeValue"
                ),
            )
          )
            throw new Error(
              `Remote capture module ${path} contains effectful decorator setup`,
            );
        }
        continue;
      }
      if (
        [
          "ImportDeclaration",
          "FunctionDeclaration",
          "TypeDeclaration",
          "ListDeclaration",
        ].includes(node.kind)
      )
        continue;
      // The compiler proved these factories effect-free and split their arguments
      // into separately validated typed startup declarations. No function enters the baseline.
      if (startupBindings?.has(node)) continue;
      if (node.kind === "Assignment" && node.target.kind === "Identifier") {
        const symbol = model.bindings.get(node.target);
        if (symbol?.declaration === node.target) {
          // Validate every top-level initializer: even unused aliases or calls can mutate captures.
          expression(node.value, model, path);
          continue;
        }
      }
      throw new Error(
        `Remote capture module ${path} contains unsupported top-level setup; move effects to explicit functions`,
      );
    }
  }
  const fields = captures.map(
    (capture, index) =>
      [
        "c" + index,
        taskWireType(
          definitions
            .get(capture.key)!
            .model.types.get(definitions.get(capture.key)!.node.target)!,
        ),
      ] as const,
  );
  const schema: TaskSchema = {
    args: [],
    result: { record: { id: "kalandra:remote-capture-baseline", fields } },
  };
  const key = schemaKey(schema);
  return {
    schema,
    code: `import helpers from "./runtime.mjs";
import "./records.mjs";
const Baseline = helpers.registerRecord("kalandra:remote-capture-baseline", class Baseline {});
export const __kalandraRecords = helpers;
export const __kalandraSchemas = { initialize: [${JSON.stringify(key)}] };
export function initialize() {
${lines.join("\n")}
const baseline = new Baseline();
${values.map((value, index) => `helpers.recordField(baseline, "c${index}", ${value});`).join("\n")}
return baseline;
}
`,
  };
}
