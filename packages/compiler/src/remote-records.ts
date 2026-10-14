import type {
  RemoteClientManifest,
  RemoteClientService,
} from "../../protocol/src/remote-contract.js";
import {
  remoteRecordScope,
  type RemoteRecordDeclaration,
  type RemoteRecordMetadata,
} from "../../protocol/src/remote-records.js";
import type { TaskSchema, WireType } from "../../protocol/src/schema.js";
import { taskWireType } from "./parallel-types.js";
import type { Program } from "./syntax/ast.js";
import type { SemanticModel } from "./semantic/types.js";
import type { IRBinding, IRStatement } from "./lowering/ir.js";
import { emitJavaScript } from "./emitter/javascript.js";
import { remoteConstructors } from "./remote-imports.js";

export function serviceRecordMetadata(
  modules: Iterable<{ program: Program; model: SemanticModel }>,
  entry: SemanticModel,
  services: Readonly<Record<string, RemoteClientService>>,
): RemoteRecordMetadata {
  const declared = new Map<string, () => RemoteRecordDeclaration>();
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
      const parent = node.parent ? model.types.get(node.parent) : undefined;
      // Convert only reachable declarations below: unused dynamic records remain valid.
      const instance = type.instance;
      declared.set(instance.id, () => ({
        name: node.name,
        fields: node.members.map((member) => {
          if (member.name.kind !== "Identifier")
            throw new Error("Invalid record field");
          return [
            member.name.name,
            taskWireType(instance.fields.get(member.name.name)!),
          ] as const;
        }),
        ...(parent?.kind === "TypeValue" && parent.instance.kind === "Named"
          ? { parent: parent.instance.id }
          : {}),
      }));
    }
  const records = new Map<string, RemoteRecordDeclaration>();
  function include(id: string) {
    if (records.has(id)) return;
    const declaration = declared.get(id);
    if (!declaration)
      throw new Error("Missing service record declaration: " + id);
    const record = declaration();
    records.set(id, record);
    if (record.parent) include(record.parent);
    record.fields.forEach(([, type]) => visit(type));
  }
  function visit(type: WireType) {
    if (typeof type === "string") return;
    if ("array" in type) visit(type.array);
    else if ("union" in type) type.union.forEach(visit);
    else include(type.record.id);
  }
  for (const service of Object.values(services))
    for (const key of service.schemas) {
      const schema = JSON.parse(key) as TaskSchema;
      schema.args.forEach(visit);
      visit(schema.result);
    }
  if (!records.size) return {};
  const types = [...entry.exports].flatMap(([name, symbol]) =>
    symbol.type.kind === "TypeValue" &&
    symbol.type.instance.kind === "Named" &&
    records.has(symbol.type.instance.id)
      ? [[name, symbol.type.instance.id] as const]
      : [],
  );
  return {
    records: Object.fromEntries(
      [...records].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
    types: Object.fromEntries(
      types.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
  };
}

/** Recreate data-only declarations locally; never import server implementations. */
export function emitRemoteRecords(
  contracts: Iterable<RemoteClientManifest>,
): string {
  const declarations = new Map<
    string,
    { record: RemoteRecordDeclaration; binding: IRBinding; parent?: string }
  >();
  for (const contract of contracts) {
    const scope = remoteRecordScope(contract.revision);
    const types = remoteConstructors(contract);
    for (const [id, record] of Object.entries(contract.records ?? {})) {
      const key = scope + id;
      const previous = declarations.get(key);
      if (
        previous &&
        JSON.stringify(previous.record) !== JSON.stringify(record)
      )
        throw new Error(
          "Conflicting remote record declarations for one deployment",
        );
      if (!previous)
        declarations.set(key, {
          record,
          binding: {
            id: declarations.size,
            name: record.name,
            type: types.get(id)!,
          },
          ...(record.parent ? { parent: scope + record.parent } : {}),
        });
    }
  }
  const source = { path: ".kalandra/remote-records.mjs", text: "" };
  const span = { file: source.path, start: 0, end: 0 };
  const body: IRStatement[] = [],
    emitted = new Set<string>();
  function emit(id: string) {
    if (emitted.has(id)) return;
    const item = declarations.get(id)!;
    if (item.parent) emit(item.parent);
    emitted.add(id);
    const parent = item.parent
      ? declarations.get(item.parent)!.binding
      : undefined;
    body.push({
      kind: "Bind",
      span,
      type: item.binding.type,
      binding: item.binding,
      value: {
        kind: "Class",
        span,
        type: item.binding.type,
        recordId: id,
        name: item.record.name,
        fields: item.record.fields.map(([name]) => name),
        parent: parent
          ? {
              kind: "Reference",
              span,
              type: parent.type,
              name: parent.name,
              binding: parent,
            }
          : null,
      },
    });
  }
  for (const id of declarations.keys()) emit(id);
  const result = emitJavaScript(
    {
      kind: "Module",
      span,
      body,
      reservedNames: [...declarations.values()].map((item) => item.record.name),
    },
    source,
    "./runtime.mjs",
  );
  if (!result.output) throw new Error("Cannot emit remote record declarations");
  return result.output.code;
}
