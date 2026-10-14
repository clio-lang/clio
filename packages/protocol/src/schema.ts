export type WireType =
  | "number"
  | "string"
  | "boolean"
  | "null"
  | "void"
  | { readonly array: WireType }
  | { readonly union: readonly WireType[] }
  | {
      readonly record: {
        readonly id: string;
        readonly fields: readonly (readonly [string, WireType])[];
      };
    };
export interface TaskSchema {
  readonly args: readonly WireType[];
  readonly result: WireType;
}

/** Canonical schema text is the v2 compatibility identity; it is not authentication. */
export function schemaKey(input: TaskSchema): string {
  let nodes = 0;
  const records = new Map<string, string>();
  function type(value: WireType, depth: number): WireType {
    if (++nodes > 1024 || depth > 32)
      throw new TypeError("Schema exceeds structural limits");
    if (
      typeof value === "string" &&
      ["number", "string", "boolean", "null", "void"].includes(value)
    )
      return value;
    if (!value || typeof value !== "object" || Object.keys(value).length !== 1)
      throw new TypeError("Unsupported wire type");
    if ("array" in value && Object.hasOwn(value, "array"))
      return { array: type(value.array, depth + 1) };
    if (
      "union" in value &&
      Object.hasOwn(value, "union") &&
      Array.isArray(value.union) &&
      value.union.length > 0 &&
      value.union.length <= 64
    ) {
      const members = Array.from(value.union, (member) =>
        type(member, depth + 1),
      );
      const unique = [
        ...new Set(members.map((member) => JSON.stringify(member))),
      ].sort();
      return { union: unique.map((member) => JSON.parse(member) as WireType) };
    }
    if ("record" in value && Object.hasOwn(value, "record")) {
      const record = value.record;
      if (
        !record ||
        Object.keys(record).sort().join() !== "fields,id" ||
        typeof record.id !== "string" ||
        !record.id.length ||
        record.id.length > 2048 ||
        !Array.isArray(record.fields) ||
        record.fields.length > 256
      )
        throw new TypeError("Invalid record schema");
      const names = new Set<string>();
      const fields = Array.from(record.fields, (field) => {
        if (
          !Array.isArray(field) ||
          field.length !== 2 ||
          typeof field[0] !== "string" ||
          !field[0].length ||
          field[0].length > 1024 ||
          names.has(field[0])
        )
          throw new TypeError("Invalid record field");
        names.add(field[0]);
        return [field[0], type(field[1]!, depth + 1)] as const;
      }).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      const definition = JSON.stringify(fields);
      if (records.has(record.id) && records.get(record.id) !== definition)
        throw new TypeError("Conflicting nominal record definitions");
      records.set(record.id, definition);
      return { record: { id: record.id, fields } };
    }
    throw new TypeError("Unsupported wire type");
  }
  if (
    !input ||
    typeof input !== "object" ||
    Object.keys(input).sort().join() !== "args,result" ||
    !Array.isArray(input.args) ||
    input.args.length > 256
  )
    throw new TypeError("Invalid task schema");
  const key = JSON.stringify({
    args: Array.from(input.args, (arg) => type(arg, 0)),
    result: type(input.result, 0),
  });
  if (key.length > 16384) throw new TypeError("Schema is too large");
  return key;
}
export function copySchema(schema: TaskSchema): TaskSchema {
  return JSON.parse(schemaKey(schema)) as TaskSchema;
}
