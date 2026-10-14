import { expect, test } from "bun:test";
import fc from "fast-check";
import { Sia } from "@timeleap/sia";
import { readNumber, writeNumber } from "../packages/protocol/src/index.js";

test("Number uses eight little-endian float64 bytes", () => {
  const sia = Sia.alloc(8);
  writeNumber(sia, 1.5);
  expect([...sia.toUint8Array()]).toEqual([0, 0, 0, 0, 0, 0, 248, 63]);
  sia.seek(0);
  expect(readNumber(sia)).toBe(1.5);
});

test("Number preserves fractions, extremes, signed zero, infinities and NaN", () => {
  for (const value of [
    0,
    -0,
    1.5,
    -1.5,
    Number.MIN_VALUE,
    Number.MAX_VALUE,
    Number.MAX_SAFE_INTEGER,
    NaN,
    Infinity,
    -Infinity,
  ]) {
    const sia = Sia.alloc(8);
    writeNumber(sia, value);
    sia.seek(0);
    expect(Object.is(readNumber(sia), value)).toBe(true);
  }
  fc.assert(
    fc.property(fc.double(), (value) => {
      const sia = Sia.alloc(8);
      writeNumber(sia, value);
      sia.seek(0);
      expect(Object.is(readNumber(sia), value)).toBe(true);
    }),
    { numRuns: 1000 },
  );
});

test("Number composes at nonzero offsets and rejects invalid input", () => {
  const sia = Sia.alloc(17);
  sia.addUInt8(42);
  writeNumber(sia, -0);
  writeNumber(sia, 1.5);
  sia.seek(1);
  expect(Object.is(readNumber(sia), -0)).toBe(true);
  expect(readNumber(sia)).toBe(1.5);
  expect(() => readNumber(Sia.alloc(7))).toThrow();
  expect(() => writeNumber(Sia.alloc(8), "1" as unknown as number)).toThrow(
    TypeError,
  );
});

import {
  frameHeader,
  encodeCall,
  decodeCall,
  encodeReply,
  decodeReply,
  schemaKey,
  type CallFrame,
  type TaskSchema,
} from "../packages/protocol/src/index.js";
const limits = { maxDataBytes: 1024 * 1024, maxDepth: 64, maxNodes: 10000 };
function call(schema: TaskSchema, args: unknown[]): CallFrame {
  return {
    kind: "call",
    id: 1,
    task: { module: "file:///task.mjs", exportName: "task0", schema, args },
    limits,
  };
}
const numeric = () => call({ args: ["number"], result: "number" }, [1.5]);

test("Sia frames round-trip concrete schemas and preserve every string code unit", () => {
  const schema: TaskSchema = {
    args: [
      "number",
      "string",
      "boolean",
      "null",
      "void",
      { array: { union: ["number", "string", "null"] } },
    ],
    result: { union: ["string", "void"] },
  };
  const request = call(schema, [
    -0,
    "emoji 🐱\u0000\ud800\udfff",
    false,
    null,
    undefined,
    [NaN, Infinity, "x", null],
  ]);
  const bytes = encodeCall(request);
  expect([...bytes.slice(0, 7)]).toEqual([75, 65, 76, 83, 3, 0, 1]);
  const decoded = decodeCall(bytes);
  expect(decoded.task.args).toEqual(request.task.args);
  expect(Object.is(decoded.task.args[0], -0)).toBe(true);
  expect(schemaKey(decoded.task.schema)).toBe(schemaKey(schema));
  for (const value of [undefined, "\ud800"])
    expect(
      decodeReply(
        encodeReply(request, { kind: "result", id: 1, value }),
        request,
      ),
    ).toEqual({ kind: "result", id: 1, value });
  for (const stack of [undefined, "", "trace\udfff"]) {
    const reply = {
      kind: "failure" as const,
      id: 1,
      error: {
        name: "Error",
        message: "failure",
        ...(stack === undefined ? {} : { stack }),
      },
    };
    expect(decodeReply(encodeReply(request, reply), request)).toEqual(reply);
  }
});

test("frame storage is owned and independent across encodes", () => {
  const first = encodeCall(numeric());
  const saved = first.slice();
  const second = encodeCall(
    call({ args: ["string"], result: "void" }, ["different"]),
  );
  second.fill(0);
  expect(first).toEqual(saved);
  expect(decodeCall(first).task.args).toEqual([1.5]);
});

test("schemas reject Any, cycles, sparse schemas and unsupported shapes", () => {
  for (const schema of [
    { args: ["Any"], result: "number" },
    { args: [], result: { object: {} } },
    { args: [], result: { union: [] } },
    { args: [], result: { union: new Array(2) } },
    { args: new Array(1), result: "void" },
    { args: [], result: "void", unknown: 1 },
  ])
    expect(() => schemaKey(schema as TaskSchema)).toThrow();
  const cyclic: any = { array: null };
  cyclic.array = cyclic;
  expect(() => schemaKey({ args: [], result: cyclic })).toThrow();
  expect(
    schemaKey({ args: [], result: { union: ["number", "string", "number"] } }),
  ).toBe(schemaKey({ args: [], result: { union: ["string", "number"] } }));
});

test("encoders reject type mismatches without numeric coercion or a dynamic fallback", () => {
  const request = numeric();
  for (const value of ["1", undefined, {}, 1n, () => 1]) {
    expect(() =>
      encodeCall({ ...request, task: { ...request.task, args: [value] } }),
    ).toThrow();
    expect(() =>
      encodeReply(request, { kind: "result", id: 1, value }),
    ).toThrow();
  }
  expect(() =>
    encodeCall({ ...request, task: { ...request.task, args: [] } }),
  ).toThrow();
  expect(() =>
    encodeReply(request, { kind: "result", id: 2, value: 1 }),
  ).toThrow();
  const arrayCall = (value: unknown[]) =>
    call({ args: [{ union: [{ array: "number" }, "null"] }], result: "void" }, [
      value,
    ]);
  expect(() => encodeCall(arrayCall(new Array(2)))).toThrow();
  let accessed = false;
  const getter = Object.defineProperty([], "0", {
    enumerable: true,
    get() {
      accessed = true;
      return 1;
    },
  });
  expect(() => encodeCall(arrayCall(getter))).toThrow();
  expect(accessed).toBe(false);
});

test("decoders reject truncation, trailing bytes, versions, wrong IDs and wrong schemas", () => {
  const request = numeric(),
    bytes = encodeCall(request);
  for (let length = 0; length < bytes.length; length++)
    expect(() => decodeCall(bytes.slice(0, length))).toThrow();
  const reply = encodeReply(request, { kind: "result", id: 1, value: 2.5 });
  for (let length = 0; length < reply.length; length++)
    expect(() => decodeReply(reply.slice(0, length), request)).toThrow();
  expect(() => decodeCall(new Uint8Array([...bytes, 0]))).toThrow();
  expect(() => decodeReply(new Uint8Array([...reply, 0]), request)).toThrow();
  for (const offset of [0, 4, 6]) {
    const corrupt = bytes.slice();
    corrupt[offset] = 255;
    expect(() => decodeCall(corrupt)).toThrow();
  }
  expect(() => decodeReply(reply, { ...request, id: 2 })).toThrow();
  expect(() =>
    decodeReply(reply, call({ args: ["number"], result: "string" }, [1])),
  ).toThrow();
  expect(() => decodeReply(bytes, request)).toThrow();
  expect(() => decodeCall({})).toThrow();
});

test("lengths, structural limits, booleans and union tags are checked before decoding values", () => {
  const request = call({ args: [{ array: "void" }], result: "boolean" }, [
    [undefined],
  ]);
  const corrupt = encodeCall(request);
  new DataView(corrupt.buffer).setUint32(corrupt.length - 4, 0xffffffff, true);
  expect(() => decodeCall(corrupt)).toThrow("node limit");
  const boolean = encodeReply(request, { kind: "result", id: 1, value: true });
  boolean[boolean.length - 1] = 2;
  expect(() => decodeReply(boolean, request)).toThrow("boolean");
  const unionCall = call({ args: [], result: { union: ["void", "null"] } }, []);
  const union = encodeReply(unionCall, { kind: "result", id: 1, value: null });
  union[union.length - 1] = 255;
  expect(() => decodeReply(union, unionCall)).toThrow("union");
  expect(() =>
    encodeCall({ ...request, limits: { ...limits, maxNodes: 1 } }),
  ).toThrow();
  expect(() =>
    encodeCall({ ...numeric(), limits: { ...limits, maxDataBytes: 7 } }),
  ).toThrow();
  expect(() =>
    encodeCall({ ...request, limits: { ...limits, maxDepth: 9999 } }),
  ).toThrow();
});

test("random float and UTF-16 values round-trip through complete request and result frames", () => {
  fc.assert(
    fc.property(
      fc.double(),
      fc.array(fc.integer({ min: 0, max: 65535 }), { maxLength: 60 }),
      (number, units) => {
        const string = String.fromCharCode(...units);
        const request = call(
          { args: ["number", "string"], result: { array: "number" } },
          [number, string],
        );
        const decoded = decodeCall(encodeCall(request));
        expect(Object.is(decoded.task.args[0], number)).toBe(true);
        expect(decoded.task.args[1]).toBe(string);
        const reply = decodeReply(
          encodeReply(request, { kind: "result", id: 1, value: [number] }),
          request,
        );
        expect(
          reply.kind === "result" &&
            Object.is((reply.value as number[])[0], number),
        ).toBe(true);
      },
    ),
    { numRuns: 250 },
  );
});

test("decoders enforce declared depth and reject oversized strings before allocation", () => {
  const request = call(
    { args: [{ array: { array: "number" } }], result: "void" },
    [[[1]]],
  );
  const bytes = encodeCall(request);
  // Payload is two array lengths and one float64; depth is the middle limit field.
  new DataView(bytes.buffer).setUint32(bytes.length - 16 - 8, 1, true);
  expect(() => decodeCall(bytes)).toThrow("structural limits");
  const string = encodeCall(call({ args: ["string"], result: "void" }, [""]));
  new DataView(string.buffer).setUint32(string.length - 4, 0xffffffff, true);
  expect(() => decodeCall(string)).toThrow("String exceeds limit");
});

test("record codecs preserve nominal IDs, nested fields and canonical order", () => {
  const point = {
    record: {
      id: "types:Point",
      fields: [
        ["z", "number"],
        ["a", "string"],
      ],
    },
  } as const;
  const other = {
    record: { id: "types:Other", fields: point.record.fields },
  } as const;
  const schema: TaskSchema = {
    args: [{ array: { union: [point, other] } }],
    result: point,
  };
  const value = { $record: "types:Point", fields: { z: 1.5, a: "hi\ud800" } };
  const request = call(schema, [[value, { ...value, $record: "types:Other" }]]);
  expect(decodeCall(encodeCall(request)).task.args).toEqual(request.task.args);
  expect(
    decodeReply(
      encodeReply(request, { kind: "result", id: 1, value }),
      request,
    ),
  ).toEqual({ kind: "result", id: 1, value });
  const changed = call(
    { ...schema, result: other },
    request.task.args as unknown[],
  );
  expect(() =>
    decodeReply(
      encodeReply(request, { kind: "result", id: 1, value }),
      changed,
    ),
  ).toThrow("identity");
  expect(() =>
    encodeReply(request, {
      kind: "result",
      id: 1,
      value: { ...value, $record: "types:Other" },
    }),
  ).toThrow();
  for (const fields of [
    { z: 1.5 },
    { z: 1.5, a: "hi", extra: 1 },
    { z: "bad", a: "hi" },
  ])
    expect(() =>
      encodeReply(request, {
        kind: "result",
        id: 1,
        value: { ...value, fields },
      }),
    ).toThrow();
  expect(() =>
    schemaKey({
      args: [],
      result: {
        record: {
          id: "x",
          fields: [
            ["a", "number"],
            ["a", "string"],
          ],
        },
      },
    }),
  ).toThrow();
  expect(() =>
    schemaKey({
      args: [],
      result: { record: { id: "x", fields: [["a", "Any" as any]] } },
    }),
  ).toThrow();
});

test("one schema cannot give a nominal record ID conflicting definitions", () => {
  expect(() =>
    schemaKey({
      args: [{ record: { id: "Point", fields: [["x", "number"]] } }],
      result: { record: { id: "Point", fields: [["x", "string"]] } },
    }),
  ).toThrow("Conflicting nominal");
});

test("nested frame ancestry is bounded and routing still requires full schema decoding", () => {
  const child: CallFrame = { ...numeric(), parentId: 42 };
  const bytes = encodeCall(child);
  expect(frameHeader(bytes)).toEqual({ kind: 1, id: child.id });
  expect(decodeCall(bytes).parentId).toBe(42);
  expect(decodeCall(encodeCall(numeric())).parentId).toBeUndefined();
  const result = encodeReply(child, {
    kind: "result",
    id: child.id,
    value: 2.5,
  });
  expect(frameHeader(result)).toEqual({ kind: 2, id: child.id });
  expect(decodeReply(result, child)).toMatchObject({ value: 2.5 });
  for (const parentId of [-1, NaN, Infinity, 1.5]) {
    expect(() => encodeCall({ ...child, parentId })).toThrow();
    const corrupt = bytes.slice();
    new DataView(corrupt.buffer).setFloat64(15, parentId, true);
    expect(() => decodeCall(corrupt)).toThrow();
  }
  const old = bytes.slice();
  old[4] = 2;
  expect(() => decodeCall(old)).toThrow();
  const truncated = bytes.slice(0, 15);
  expect(frameHeader(truncated)).toEqual({ kind: 1, id: child.id });
  expect(() => decodeCall(truncated)).toThrow();
});
