import type { SourceFile } from "./index.js";
import type { Program, TypeDeclaration } from "./syntax/ast.js";
import type { SemanticModel, TypeValue } from "./semantic/types.js";
import type { IRBinding, IRExpression, IRStatement } from "./lowering/ir.js";
import { emitJavaScript } from "./emitter/javascript.js";

/** Pure constructors shared by application modules and task companions, without application initializers. */
export function emitTaskRecords(
  modules: Iterable<{ program: Program; model: SemanticModel }>,
  importedRecords: ReadonlySet<string> = new Set(),
): string {
  const records = new Map<
    string,
    {
      node: TypeDeclaration;
      model: SemanticModel;
      type: TypeValue;
      binding: IRBinding;
    }
  >();
  for (const { program, model } of modules)
    for (const statement of program.body) {
      const node =
        statement.kind === "ExportDeclaration"
          ? statement.declaration
          : statement;
      if (node.kind !== "TypeDeclaration") continue;
      const type = model.bindings.get(node)?.type;
      if (
        type?.kind !== "TypeValue" ||
        type.instance.kind !== "Named" ||
        !type.instance.taskRecord
      )
        continue;
      records.set(type.instance.id, {
        node,
        model,
        type,
        binding: { id: records.size, name: node.name, type },
      });
    }
  const source: SourceFile = { path: ".kalandra/records.mjs", text: "" };
  const span = { file: source.path, start: 0, end: 0 };
  const body: IRStatement[] = [],
    emitted = new Set<string>();
  function emit(id: string) {
    if (emitted.has(id)) return;
    const record = records.get(id);
    if (!record) throw new Error(`Missing declared record ${id}`);
    emitted.add(id);
    const { node, model, type, binding } = record;
    const parentType = node.parent ? model.types.get(node.parent) : undefined;
    const parentId =
      parentType?.kind === "TypeValue" && parentType.instance.kind === "Named"
        ? parentType.instance.id
        : undefined;
    let parent: IRExpression | null = null;
    if (parentId) {
      if (importedRecords.has(parentId)) {
        // Remote constructors are registered before this module executes.
        parent = {
          kind: "Call",
          span,
          type: parentType!,
          construct: false,
          callee: {
            kind: "Helper",
            span,
            type: { kind: "Function" },
            name: "getRecord",
          },
          arguments: [
            {
              kind: "Literal",
              span,
              type: { kind: "String" },
              value: parentId,
            },
          ],
        };
      } else {
        emit(parentId);
        const binding = records.get(parentId)!.binding;
        parent = {
          kind: "Reference",
          span,
          type: binding.type,
          name: binding.name,
          binding,
        };
      }
    }
    body.push({
      kind: "Bind",
      span,
      type,
      binding,
      value: {
        kind: "Class",
        span,
        type,
        recordId: id,
        name: node.name,
        fields: node.members.map((member) =>
          member.name.kind === "Identifier" ? member.name.name : "",
        ),
        parent,
      },
    });
  }
  for (const id of records.keys()) emit(id);
  const result = emitJavaScript(
    {
      kind: "Module",
      span,
      body,
      reservedNames: [...records.values()].map((record) => record.node.name),
    },
    source,
    "./runtime.mjs",
  );
  if (!result.output) throw new Error("Cannot emit task record constructors");
  return result.output.code;
}
