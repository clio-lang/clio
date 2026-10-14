import { schemaKey, type WireType, type TaskSchema } from "./schema.js";

export interface RemoteRecordDeclaration {
  readonly name: string;
  /** Own fields in constructor order; inherited arguments follow these. */
  readonly fields: readonly (readonly [string, WireType])[];
  readonly parent?: string;
}
export interface RemoteRecordMetadata {
  readonly records?: Readonly<Record<string, RemoteRecordDeclaration>>;
  readonly types?: Readonly<Record<string, string>>;
}
export const remoteRecordScope = (revision: string) => `remote:${revision}:`;

/** Check nominal definitions across every service, not just within one schema. */
export function validateRemoteRecords(
  input: RemoteRecordMetadata,
  schemas: readonly TaskSchema[],
  serviceNames: readonly string[],
): RemoteRecordMetadata {
  const definitions = new Map<string, string>();
  function collect(type: WireType) {
    if (typeof type === "string") return;
    if ("array" in type) return collect(type.array);
    if ("union" in type) {
      type.union.forEach(collect);
      return;
    }
    const key = schemaKey({ args: [], result: type });
    if (
      definitions.has(type.record.id) &&
      definitions.get(type.record.id) !== key
    )
      throw new TypeError("Conflicting remote record definitions");
    definitions.set(type.record.id, key);
    if (definitions.size > 256) throw new TypeError("Too many remote records");
    type.record.fields.forEach(([, field]) => collect(field));
  }
  for (const schema of schemas) {
    schema.args.forEach(collect);
    collect(schema.result);
  }
  if (
    input.records === undefined &&
    input.types === undefined &&
    !definitions.size
  )
    return {};
  if (
    !input.records ||
    typeof input.records !== "object" ||
    Array.isArray(input.records)
  )
    throw new TypeError("Remote record declarations are required");
  const entries = Object.entries(input.records);
  if (entries.length > 256)
    throw new TypeError("Too many remote record declarations");
  const records = new Map<string, RemoteRecordDeclaration>();
  for (const [id, record] of entries) {
    if (
      !id ||
      id.length > 1800 ||
      !record ||
      typeof record.name !== "string" ||
      !record.name.length ||
      record.name.length > 1024 ||
      !Array.isArray(record.fields) ||
      (record.parent !== undefined && typeof record.parent !== "string")
    )
      throw new TypeError("Invalid remote record declaration");
    // Validate names and wire shapes, retaining the separate constructor field order.
    schemaKey({ args: [], result: { record: { id, fields: record.fields } } });
    const canonical = JSON.parse(
      schemaKey({
        args: record.fields.map(([, type]) => type),
        result: "void",
      }),
    ) as TaskSchema;
    records.set(id, {
      name: record.name,
      fields: record.fields.map(
        ([name], index) => [name, canonical.args[index]!] as const,
      ),
      ...(record.parent === undefined ? {} : { parent: record.parent }),
    });
  }
  const flattened = new Map<string, readonly (readonly [string, WireType])[]>();
  function fields(
    id: string,
    visiting = new Set<string>(),
  ): readonly (readonly [string, WireType])[] {
    const saved = flattened.get(id);
    if (saved) return saved;
    const record = records.get(id);
    if (!record)
      throw new TypeError("Missing remote record declaration: " + id);
    if (visiting.has(id) || visiting.size >= 32)
      throw new TypeError("Invalid remote record inheritance");
    visiting.add(id);
    const result = new Map(record.fields);
    if (record.parent !== undefined)
      for (const [name, type] of fields(record.parent, visiting))
        if (!result.has(name)) result.set(name, type);
    visiting.delete(id);
    const all = [...result];
    flattened.set(id, all);
    collect({ record: { id, fields: all } });
    return all;
  }
  for (const id of records.keys()) fields(id);
  for (const id of definitions.keys())
    if (!records.has(id))
      throw new TypeError("Missing remote record declaration: " + id);
  const types = input.types ?? {};
  if (
    !types ||
    typeof types !== "object" ||
    Array.isArray(types) ||
    Object.keys(types).length > 256
  )
    throw new TypeError("Invalid remote record exports");
  for (const [name, id] of Object.entries(types))
    if (
      !name ||
      name.length > 1024 ||
      typeof id !== "string" ||
      !records.has(id) ||
      serviceNames.includes(name)
    )
      throw new TypeError("Invalid or conflicting remote record export");
  return {
    records: Object.fromEntries(records),
    types: Object.fromEntries(Object.entries(types)),
  };
}
