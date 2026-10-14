import {
  decodeCall,
  decodeReply,
  encodeCall,
  frameHeader,
  encodeReply,
  schemaKey,
  type CallFrame,
  type ReplyFrame,
} from "../../protocol/src/index.js";
import { snapshotValue, type WorkerRequest } from "./index.js";

export interface WorkerHandlerHost {
  send(message: unknown): void;
  fatal(error: unknown): void;
  moduleUrl(value: string): string;
  readonly maxChildren: number;
  readonly allowUntyped?: boolean;
}

/** Shared task execution and record reconstruction for isolated runtime hosts. */
export function createWorkerHandler(host: WorkerHandlerHost) {
  const active = new Set<number>();
  const children = new Map<
    number,
    {
      call: CallFrame;
      resolve(value: unknown): void;
      reject(error: Error): void;
    }
  >();
  const maxChildren = host.maxChildren;
  if (!Number.isSafeInteger(maxChildren) || maxChildren < 0)
    throw new Error("Invalid nesting limit");
  let nextChildId = 1;
  function dispatch(
    parent: CallFrame,
    task: import("./index.js").ModuleTask,
  ): Promise<unknown> {
    if (!active.has(parent.id) || !task.schema)
      return Promise.reject(
        new Error("Child tasks require an active typed parent"),
      );
    if (children.size >= maxChildren)
      return Promise.reject(
        new Error("Nested outstanding task limit exceeded"),
      );
    const call: CallFrame = {
      kind: "call",
      id: nextChildId++,
      parentId: parent.id,
      task: { ...task, schema: task.schema },
      limits: parent.limits,
    };
    return new Promise((resolve, reject) => {
      try {
        const bytes = encodeCall(call);
        children.set(call.id, { call, resolve, reject });
        host.send(bytes);
      } catch (error) {
        children.delete(call.id);
        reject(error);
      }
    });
  }
  return async (message: unknown) => {
    // Malformed byte frames are protocol failures: exit instead of inventing a task ID.
    let call: CallFrame | undefined;
    try {
      if (message instanceof Uint8Array) {
        const header = frameHeader(message);
        if (header.kind !== 1) {
          const child = children.get(header.id);
          if (!child) throw new Error("Unknown child response");
          const reply = decodeReply(message, child.call);
          children.delete(header.id);
          if (reply.kind === "result") child.resolve(reply.value);
          else child.reject(new Error(reply.error.message));
          return;
        }
        call = decodeCall(message);
        if (call.parentId !== undefined)
          throw new Error("Worker received an unadmitted child request");
      }
      if (!call && !host.allowUntyped)
        throw new Error("Worker tasks require Sia byte frames");
    } catch (error) {
      host.fatal(error);
      return;
    }
    const request = (call ?? message) as WorkerRequest;
    const send = (reply: ReplyFrame) =>
      host.send(call ? encodeReply(call, reply) : reply);
    if (active.has(request.id) || (!call && active.size)) {
      host.fatal(new Error("Duplicate or overlapping task request"));
      return;
    }
    active.add(request.id);
    try {
      if (request.kind !== "call" || !Number.isSafeInteger(request.id))
        throw new Error("Invalid task request");
      if (!call && request.task.schema)
        throw new TypeError("Typed tasks require Sia byte frames");
      const module = await import(host.moduleUrl(request.task.module));
      if (
        !Object.hasOwn(module, request.task.exportName) ||
        typeof module[request.task.exportName] !== "function"
      )
        throw new Error(`Missing callable export ${request.task.exportName}`);
      if (call) {
        const manifest = module.__kalandraSchemas;
        if (
          !manifest ||
          !Object.hasOwn(manifest, request.task.exportName) ||
          !Array.isArray(manifest[request.task.exportName]) ||
          !manifest[request.task.exportName].includes(
            schemaKey(call.task.schema),
          )
        )
          throw new TypeError(
            "Task schema does not match the compiled worker module; rebuild the program",
          );
      }
      const hasRecords = (
        type: import("../../protocol/src/index.js").WireType,
      ): boolean =>
        typeof type !== "string" &&
        ("record" in type ||
          ("array" in type
            ? hasRecords(type.array)
            : type.union.some(hasRecords)));
      if (
        call &&
        [call.task.schema.result, ...call.task.schema.args].some(hasRecords) &&
        !module.__kalandraRecords
      )
        throw new TypeError(
          "Typed record tasks require generated record reconstruction helpers",
        );
      const callable = module[request.task.exportName];
      const args =
        call && module.__kalandraRecords
          ? module.__kalandraRecords.unpackTaskArgs(
              call.task.schema,
              request.task.args,
            )
          : request.task.args;
      const result = await (call &&
      module.__kalandraContextTasks?.includes(request.task.exportName)
        ? callable(
            (task: import("./index.js").ModuleTask) => dispatch(call!, task),
            ...args,
          )
        : callable(...args));
      const value = snapshotValue(
        call && module.__kalandraRecords
          ? module.__kalandraRecords.packTaskResult(call.task.schema, result)
          : result,
        request.limits,
      );
      send({ kind: "result", id: request.id, value });
    } catch (error) {
      // Even non-Error throws and unserializable return values settle the caller.
      let failure: {
        name: string;
        message: string;
        stack?: string | undefined;
      };
      try {
        failure =
          error instanceof Error
            ? {
                name: String(error.name).slice(0, 256),
                message: String(error.message).slice(0, 4096),
                stack:
                  typeof error.stack === "string"
                    ? error.stack.slice(0, 16384)
                    : undefined,
              }
            : { name: "Error", message: String(error).slice(0, 4096) };
      } catch {
        failure = {
          name: "Error",
          message: "Task failed with an unprintable error",
        };
      }
      send({ kind: "failure", id: request.id, error: failure });
    } finally {
      active.delete(request.id);
    }
  };
}
