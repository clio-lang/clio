import {
  encodeCall,
  decodeCall,
  encodeReply,
  frameHeader,
  decodeReply,
  type CallFrame,
} from "../../protocol/src/index.js";
import type { WorkerEndpoint, WorkerRequest } from "./index.js";

/** Protocol state belongs to a worker connection, independent of its transport. */
export function createWorkerEndpoint(
  transport: {
    send(message: unknown): void;
    terminate(): Promise<void>;
  },
  allowUntyped = false,
) {
  let onMessage: (message: unknown) => void = () => {};
  let onFailure: (error: unknown) => void = () => {};
  const active = new Map<number, WorkerRequest>();
  const children = new Map<number, CallFrame>();
  let lastChildId = 0;
  let stopped = false;
  const fail = (error: unknown) => {
    if (!stopped) onFailure(error);
  };
  const receive = (message: unknown) => {
    if (stopped) return;
    try {
      if (message instanceof Uint8Array) {
        const header = frameHeader(message);
        if (header.kind === 1) {
          const call = decodeCall(message);
          const parent = call.parentId ? active.get(call.parentId) : undefined;
          if (
            !parent?.task.schema ||
            call.id <= lastChildId ||
            Object.keys(parent.limits).some(
              (key) =>
                parent.limits[key as keyof typeof parent.limits] !==
                call.limits[key as keyof typeof call.limits],
            )
          )
            throw new Error("Invalid child task ancestry, ID or limits");
          lastChildId = call.id;
          children.set(call.id, call);
          onMessage({
            kind: "spawn",
            id: call.parentId,
            requestId: call.id,
            task: call.task,
          });
        } else {
          const call = active.get(header.id);
          if (!call?.task.schema)
            throw new Error("Unexpected typed worker reply");
          const reply = decodeReply(message, call as CallFrame);
          active.delete(header.id);
          onMessage(reply);
        }
      } else {
        const id =
          message && typeof message === "object" && "id" in message
            ? message.id
            : undefined;
        const call = active.get(id as number);
        if (!allowUntyped || !call || call.task.schema)
          throw new Error("Unexpected untyped worker reply");
        active.delete(id as number);
        onMessage(message);
      }
    } catch (error) {
      fail(error);
    }
  };
  const endpoint: WorkerEndpoint = {
    subscribe(message, failure) {
      onMessage = message;
      onFailure = failure;
      return () => {
        onMessage = () => {};
        onFailure = () => {};
      };
    },
    send(request) {
      if (stopped) throw new Error("Worker connection is closed");
      if (!allowUntyped && !request.task.schema)
        throw new TypeError("Browser worker tasks require a Sia schema");
      active.set(request.id, request);
      transport.send(
        request.task.schema ? encodeCall(request as CallFrame) : request,
      );
    },
    reply(reply) {
      const call = children.get(reply.id);
      if (!call) throw new Error("Unknown child reply");
      children.delete(reply.id);
      transport.send(encodeReply(call, reply));
    },
    async terminate() {
      stopped = true;
      active.clear();
      children.clear();
      await transport.terminate();
    },
  };
  return { endpoint, receive, fail };
}
