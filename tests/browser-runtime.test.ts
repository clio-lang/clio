import { expect, test } from "bun:test";
import { createWorkerEndpoint } from "../packages/runtime/src/worker-endpoint.js";
import { createWorkerHandler } from "../packages/runtime/src/worker-handler.js";
import {
  encodeCall,
  encodeReply,
  type CallFrame,
} from "../packages/protocol/src/index.js";
import {
  defaultValueLimits,
  type WorkerRequest,
} from "../packages/runtime/src/index.js";

const call: CallFrame & WorkerRequest = {
  kind: "call",
  id: 1,
  limits: defaultValueLimits,
  task: {
    module: "https://example.test/tasks.js",
    exportName: "echo",
    args: [1.5],
    schema: { args: ["number"], result: "number" },
  },
};

test("typed worker endpoint verifies replies, rejects untyped tasks and ignores terminated traffic", async () => {
  const sent: unknown[] = [],
    messages: unknown[] = [],
    errors: unknown[] = [];
  let terminated = false;
  const bridge = createWorkerEndpoint({
    send: (message) => sent.push(message),
    async terminate() {
      terminated = true;
    },
  });
  bridge.endpoint.subscribe(
    (message) => messages.push(message),
    (error) => errors.push(error),
  );
  bridge.endpoint.send(call);
  expect(sent[0]).toBeInstanceOf(Uint8Array);
  bridge.receive(encodeReply(call, { kind: "result", id: 1, value: 1.5 }));
  expect(messages).toEqual([{ kind: "result", id: 1, value: 1.5 }]);
  bridge.receive(encodeReply(call, { kind: "result", id: 1, value: 1.5 }));
  expect(errors).toHaveLength(1);
  expect(() =>
    bridge.endpoint.send({
      ...call,
      task: { module: call.task.module, exportName: "echo", args: [] },
    }),
  ).toThrow("Sia schema");
  await bridge.endpoint.terminate();
  bridge.receive(new Uint8Array());
  bridge.fail(new Error("late error"));
  expect(errors).toHaveLength(1);
  expect(terminated).toBe(true);
  expect(() => bridge.endpoint.send(call)).toThrow("closed");
});

test("typed worker endpoint enforces child ancestry, monotonic IDs and inherited limits", () => {
  for (const child of [
    { ...call, id: 2, parentId: 99 },
    {
      ...call,
      id: 2,
      parentId: 1,
      limits: { ...call.limits, maxDepth: call.limits.maxDepth + 1 },
    },
  ]) {
    const errors: unknown[] = [];
    const bridge = createWorkerEndpoint({ send() {}, async terminate() {} });
    bridge.endpoint.subscribe(
      () => {
        throw new Error("must not admit child");
      },
      (error) => errors.push(error),
    );
    bridge.endpoint.send(call);
    bridge.receive(encodeCall(child));
    expect(errors).toHaveLength(1);
  }
  const messages: unknown[] = [],
    errors: unknown[] = [],
    sent: unknown[] = [];
  const bridge = createWorkerEndpoint({
    send: (message) => sent.push(message),
    async terminate() {},
  });
  bridge.endpoint.subscribe(
    (message) => messages.push(message),
    (error) => errors.push(error),
  );
  bridge.endpoint.send(call);
  const child = { ...call, id: 2, parentId: 1 };
  bridge.receive(encodeCall(child));
  expect(messages).toHaveLength(1);
  bridge.endpoint.reply!({ kind: "result", id: 2, value: 3 });
  expect(sent[1]).toBeInstanceOf(Uint8Array);
  bridge.receive(encodeCall(child));
  expect(errors).toHaveLength(1);
});

test("typed worker handler rejects malformed frames and structured objects before import", async () => {
  const failures: unknown[] = [];
  const receive = createWorkerHandler({
    maxChildren: 0,
    send() {
      throw new Error("must not reply");
    },
    fatal: (error) => failures.push(error),
    moduleUrl() {
      throw new Error("must not import");
    },
  });
  await receive(call);
  await receive(new Uint8Array([1, 2, 3]));
  await receive(encodeCall({ ...call, parentId: 1 }));
  expect(failures).toHaveLength(3);
});
