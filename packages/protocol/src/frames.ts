import { Sia } from "@timeleap/sia";
import { readNumber, writeNumber } from "./number.js";
import { schemaKey, type TaskSchema, type WireType } from "./schema.js";

export interface CodecLimits {
  readonly maxDataBytes: number;
  readonly maxDepth: number;
  readonly maxNodes: number;
}
export interface SchemaTask {
  readonly module: string;
  readonly exportName: string;
  readonly args: readonly unknown[];
  readonly schema: TaskSchema;
}
export interface CallFrame {
  readonly kind: "call";
  /** Worker-originated child submission; absent on admitted execution requests. */
  readonly parentId?: number;
  readonly id: number;
  readonly task: SchemaTask;
  readonly limits: CodecLimits;
}
export type ReplyFrame =
  | { readonly kind: "result"; readonly id: number; readonly value: unknown }
  | {
      readonly kind: "failure";
      readonly id: number;
      readonly error: {
        readonly name: string;
        readonly message: string;
        readonly stack?: string | undefined;
      };
    };

const MAGIC = 0x534c414b;
export const wireVersion = 3;
const overheadLimit = 128 * 1024;
const absoluteDataLimit = 64 * 1024 * 1024;
function limitsValid(limits: CodecLimits) {
  if (
    ![limits.maxDataBytes, limits.maxDepth, limits.maxNodes].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    ) ||
    limits.maxDataBytes > absoluteDataLimit ||
    limits.maxDepth > 256 ||
    limits.maxNodes > 1_000_000
  )
    throw new TypeError("Unsupported protocol limits");
}
function idValid(id: number) {
  if (!Number.isSafeInteger(id) || id < 1)
    throw new TypeError("Invalid task ID");
}
class Writer {
  size = 0;
  constructor(
    readonly maximum: number,
    readonly sia?: Sia,
  ) {}
  reserve(size: number) {
    this.size += size;
    if (this.size > this.maximum)
      throw new TypeError("Frame exceeds byte limit");
  }
  u8(value: number) {
    this.reserve(1);
    this.sia?.addUInt8(value);
  }
  u16(value: number) {
    this.reserve(2);
    this.sia?.addUInt16(value);
  }
  u32(value: number) {
    this.reserve(4);
    this.sia?.addUInt32(value);
  }
  number(value: number) {
    this.reserve(8);
    if (this.sia) writeNumber(this.sia, value);
  }
  string(value: string, maximum = absoluteDataLimit / 2) {
    if (typeof value !== "string" || value.length > maximum)
      throw new TypeError("Invalid or oversized string");
    this.u32(value.length);
    this.reserve(value.length * 2);
    if (this.sia)
      for (let index = 0; index < value.length; index++)
        this.sia.addUInt16(value.charCodeAt(index));
  }
}
class Reader {
  readonly sia: Sia;
  constructor(bytes: unknown, maximum: number) {
    if (
      !(bytes instanceof Uint8Array) ||
      !(bytes.buffer instanceof ArrayBuffer) ||
      bytes.length > maximum
    )
      throw new TypeError("Expected a bounded byte frame");
    this.sia = new Sia(bytes);
  }
  need(size: number) {
    if (size > this.sia.content.length - this.sia.offset)
      throw new TypeError("Truncated frame");
  }
  u8() {
    this.need(1);
    return this.sia.readUInt8();
  }
  u16() {
    this.need(2);
    return this.sia.readUInt16();
  }
  u32() {
    this.need(4);
    return this.sia.readUInt32();
  }
  number() {
    this.need(8);
    return readNumber(this.sia);
  }
  string(maximum = absoluteDataLimit / 2) {
    const length = this.u32();
    if (length > maximum) throw new TypeError("String exceeds limit");
    this.need(length * 2);
    // Chunked assembly avoids argument limits and quadratic concatenation.
    const chunks: string[] = [];
    for (let offset = 0; offset < length;) {
      const units: number[] = [];
      const end = Math.min(offset + 4096, length);
      while (offset < end) {
        units.push(this.sia.readUInt16());
        offset++;
      }
      chunks.push(String.fromCharCode(...units));
    }
    return chunks.join("");
  }
  end() {
    if (this.sia.offset !== this.sia.content.length)
      throw new TypeError("Trailing frame bytes");
  }
}
function frame(maximum: number, emit: (writer: Writer) => void): Uint8Array {
  const measurement = new Writer(maximum);
  emit(measurement);
  const sia = Sia.alloc(measurement.size);
  emit(new Writer(maximum, sia));
  return sia.toUint8Array(); // Owned exact-length bytes; never the shared Sia buffer.
}
class Budget {
  nodes = 0;
  constructor(readonly limits: CodecLimits) {}
  visit(depth: number) {
    if (++this.nodes > this.limits.maxNodes || depth > this.limits.maxDepth)
      throw new TypeError("Value exceeds structural limits");
  }
  array(length: number) {
    if (length > this.limits.maxNodes - this.nodes)
      throw new TypeError("Array exceeds node limit");
  }
}
function recordValues(
  value: unknown,
  id: string,
  count: number,
): Record<string, unknown> | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Reflect.ownKeys(value).length !== 2
  )
    return;
  const tag = Object.getOwnPropertyDescriptor(value, "$record"),
    values = Object.getOwnPropertyDescriptor(value, "fields");
  if (
    !tag ||
    !("value" in tag) ||
    tag.value !== id ||
    !tag.enumerable ||
    !values ||
    !("value" in values) ||
    !values.enumerable ||
    !values.value ||
    typeof values.value !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(values.value)) ||
    Reflect.ownKeys(values.value).length !== count
  )
    return;
  return values.value;
}
function matches(type: WireType, value: unknown, maxNodes: number): boolean {
  if (typeof type === "string")
    return type === "void"
      ? value === undefined
      : type === "null"
        ? value === null
        : typeof value === type;
  if ("array" in type) {
    if (!Array.isArray(value) || value.length > maxNodes) return false;
    for (let index = 0; index < value.length; index++) {
      const property = Object.getOwnPropertyDescriptor(value, index);
      if (
        !property ||
        !("value" in property) ||
        !matches(type.array, property.value, maxNodes)
      )
        return false;
    }
    return true;
  }
  if ("record" in type) {
    const values = recordValues(
      value,
      type.record.id,
      type.record.fields.length,
    );
    return (
      !!values &&
      type.record.fields.every((field) => {
        const property = Object.getOwnPropertyDescriptor(values, field[0]);
        return (
          !!property &&
          "value" in property &&
          matches(field[1], property.value, maxNodes)
        );
      })
    );
  }
  return type.union.some((member) => matches(member, value, maxNodes));
}
function put(
  writer: Writer,
  type: WireType,
  value: unknown,
  budget: Budget,
  depth = 0,
): void {
  budget.visit(depth);
  if (typeof type === "string") {
    if (!matches(type, value, budget.limits.maxNodes))
      throw new TypeError(`Value does not match ${type} schema`);
    if (type === "number") writer.number(value as number);
    else if (type === "string")
      writer.string(value as string, budget.limits.maxDataBytes / 2);
    else if (type === "boolean") writer.u8(value ? 1 : 0);
  } else if ("array" in type) {
    if (!Array.isArray(value))
      throw new TypeError("Value does not match array schema");
    budget.array(value.length);
    if (Reflect.ownKeys(value).length !== value.length + 1)
      throw new TypeError("Arrays must be dense and have no metadata");
    writer.u32(value.length);
    for (let index = 0; index < value.length; index++) {
      const property = Object.getOwnPropertyDescriptor(value, index);
      if (!property || !("value" in property) || !property.enumerable)
        throw new TypeError("Arrays cannot contain holes or accessors");
      put(writer, type.array, property.value, budget, depth + 1);
    }
  } else if ("record" in type) {
    const values = recordValues(
      value,
      type.record.id,
      type.record.fields.length,
    );
    if (!values) throw new TypeError("Value does not match record schema");
    budget.array(type.record.fields.length);
    type.record.fields.forEach((field) => {
      const property = Object.getOwnPropertyDescriptor(values, field[0]);
      if (!property || !("value" in property) || !property.enumerable)
        throw new TypeError("Record fields must be data values");
      put(writer, field[1], property.value, budget, depth + 1);
    });
  } else {
    const index = type.union.findIndex((member) =>
      matches(member, value, budget.limits.maxNodes),
    );
    if (index < 0) throw new TypeError("Value does not match union schema");
    writer.u16(index);
    put(writer, type.union[index]!, value, budget, depth + 1);
  }
}
function get(
  reader: Reader,
  type: WireType,
  budget: Budget,
  depth = 0,
): unknown {
  budget.visit(depth);
  if (typeof type === "string") {
    switch (type) {
      case "number":
        return reader.number();
      case "string":
        return reader.string(budget.limits.maxDataBytes / 2);
      case "null":
        return null;
      case "void":
        return undefined;
      case "boolean": {
        const value = reader.u8();
        if (value > 1) throw new TypeError("Invalid boolean");
        return value === 1;
      }
    }
  }
  if ("array" in type) {
    const length = reader.u32();
    budget.array(length);
    const result: unknown[] = [];
    for (let index = 0; index < length; index++)
      result.push(get(reader, type.array, budget, depth + 1));
    return result;
  }
  if ("record" in type) {
    budget.array(type.record.fields.length);
    return {
      $record: type.record.id,
      fields: Object.fromEntries(
        type.record.fields.map((field) => [
          field[0],
          get(reader, field[1], budget, depth + 1),
        ]),
      ),
    };
  }
  const index = reader.u16();
  if (index >= type.union.length) throw new TypeError("Invalid union variant");
  return get(reader, type.union[index]!, budget, depth + 1);
}
function header(writer: Writer, kind: number, id: number) {
  idValid(id);
  writer.u32(MAGIC);
  writer.u16(wireVersion);
  writer.u8(kind);
  writer.number(id);
}
function readHeader(reader: Reader) {
  if (reader.u32() !== MAGIC || reader.u16() !== wireVersion)
    throw new TypeError("Unsupported wire magic or version");
  const kind = reader.u8(),
    id = reader.number();
  idValid(id);
  return { kind, id };
}
function canonical(schema: TaskSchema) {
  const key = schemaKey(schema);
  return { key, schema: JSON.parse(key) as TaskSchema };
}
export function validateArguments(
  schema: TaskSchema,
  args: readonly unknown[],
  limits: CodecLimits,
): void {
  limitsValid(limits);
  const normalized = canonical(schema).schema;
  if (!Array.isArray(args) || args.length !== normalized.args.length)
    throw new TypeError("Argument count does not match schema");
  const writer = new Writer(limits.maxDataBytes),
    budget = new Budget(limits);
  normalized.args.forEach((type, index) =>
    put(writer, type, args[index], budget),
  );
}
export function encodeCall(call: CallFrame): Uint8Array {
  limitsValid(call.limits);
  const { key, schema } = canonical(call.task.schema);
  if (
    !Array.isArray(call.task.args) ||
    call.task.args.length !== schema.args.length
  )
    throw new TypeError("Argument count does not match schema");
  return frame(call.limits.maxDataBytes + overheadLimit, (writer) => {
    header(writer, 1, call.id);
    if (call.parentId !== undefined) idValid(call.parentId);
    writer.number(call.parentId ?? 0);
    writer.string(call.task.module, 8192);
    writer.string(call.task.exportName, 1024);
    writer.string(key, 16384);
    writer.u32(call.limits.maxDataBytes);
    writer.u32(call.limits.maxDepth);
    writer.u32(call.limits.maxNodes);
    const begin = writer.size,
      budget = new Budget(call.limits);
    schema.args.forEach((type, index) =>
      put(writer, type, call.task.args[index], budget),
    );
    if (writer.size - begin > call.limits.maxDataBytes)
      throw new TypeError("Payload exceeds byte limit");
  });
}
export function decodeCall(bytes: unknown): CallFrame {
  const reader = new Reader(bytes, absoluteDataLimit + overheadLimit);
  const { kind, id } = readHeader(reader);
  if (kind !== 1) throw new TypeError("Expected call frame");
  const parentId = reader.number();
  if (parentId !== 0) idValid(parentId);
  const module = reader.string(8192),
    exportName = reader.string(1024),
    key = reader.string(16384);
  const schema = JSON.parse(key) as TaskSchema;
  if (schemaKey(schema) !== key)
    throw new TypeError("Noncanonical schema identity");
  const limits = {
    maxDataBytes: reader.u32(),
    maxDepth: reader.u32(),
    maxNodes: reader.u32(),
  };
  limitsValid(limits);
  if (reader.sia.content.length - reader.sia.offset > limits.maxDataBytes)
    throw new TypeError("Payload exceeds byte limit");
  const budget = new Budget(limits),
    args = schema.args.map((type) => get(reader, type, budget));
  reader.end();
  return {
    kind: "call",
    id,
    ...(parentId ? { parentId } : {}),
    task: { module, exportName, schema, args },
    limits,
  };
}
export function encodeReply(call: CallFrame, reply: ReplyFrame): Uint8Array {
  limitsValid(call.limits);
  if (reply.id !== call.id) throw new TypeError("Reply ID mismatch");
  const { key, schema } = canonical(call.task.schema);
  return frame(call.limits.maxDataBytes + overheadLimit, (writer) => {
    header(writer, reply.kind === "result" ? 2 : 3, reply.id);
    writer.string(key, 16384);
    if (reply.kind === "result") {
      const begin = writer.size;
      put(writer, schema.result, reply.value, new Budget(call.limits));
      if (writer.size - begin > call.limits.maxDataBytes)
        throw new TypeError("Payload exceeds byte limit");
    } else {
      writer.string(reply.error.name, 256);
      writer.string(reply.error.message, 4096);
      writer.u8(reply.error.stack === undefined ? 0 : 1);
      if (reply.error.stack !== undefined)
        writer.string(reply.error.stack, 16384);
    }
  });
}
export function decodeReply(bytes: unknown, call: CallFrame): ReplyFrame {
  limitsValid(call.limits);
  const reader = new Reader(bytes, call.limits.maxDataBytes + overheadLimit);
  const { kind, id } = readHeader(reader);
  const { key, schema } = canonical(call.task.schema);
  if (id !== call.id || reader.string(16384) !== key)
    throw new TypeError("Reply identity mismatch");
  let reply: ReplyFrame;
  if (kind === 2) {
    if (
      reader.sia.content.length - reader.sia.offset >
      call.limits.maxDataBytes
    )
      throw new TypeError("Payload exceeds byte limit");
    reply = {
      kind: "result",
      id,
      value: get(reader, schema.result, new Budget(call.limits)),
    };
  } else if (kind === 3) {
    const name = reader.string(256),
      message = reader.string(4096),
      present = reader.u8();
    if (present > 1) throw new TypeError("Invalid optional stack marker");
    reply = {
      kind: "failure",
      id,
      error: {
        name,
        message,
        ...(present ? { stack: reader.string(16384) } : {}),
      },
    };
  } else throw new TypeError("Expected reply frame");
  reader.end();
  return reply;
}

/** Inspect routing only; callers must still decode the complete frame against its schema. */
export function frameHeader(bytes: unknown): { kind: number; id: number } {
  const header = readHeader(
    new Reader(bytes, absoluteDataLimit + overheadLimit),
  );
  if (![1, 2, 3].includes(header.kind))
    throw new TypeError("Unknown frame kind");
  return header;
}
