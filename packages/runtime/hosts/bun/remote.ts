import {
  copyRemoteBinding,
  bindRemoteTask,
  validateCapturePlan,
  initializeCaptures,
  serviceWorkerSchemas,
} from "./remote-captures.js";
import {
  parseRemoteClientManifest,
  parseRemoteImportManifest,
  remoteTaskModule,
} from "../../../protocol/src/remote-contract.js";
import { timingSafeEqual } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import {
  decodeCall,
  decodeReply,
  encodeCall,
  encodeReply,
  schemaKey,
  type CallFrame,
  type CodecLimits,
} from "../../../protocol/src/index.js";
import type {
  ModuleTask,
  TaskOptions,
  CancellationSignal,
} from "../../src/index.js";
import { createBunWorkerPool } from "./index.js";

export const remoteLimits: CodecLimits = {
  maxDataBytes: 1024 * 1024,
  maxDepth: 64,
  maxNodes: 10000,
};
export const maxRemoteFrameBytes = remoteLimits.maxDataBytes + 128 * 1024;
export const remoteMediaType = "application/vnd.kalandra.task";
export const remoteNetworkVersion = "2";
export interface RemoteService {
  readonly module: string;
  readonly exportName: string;
  readonly schemas: readonly string[];
}
export interface RemoteDeployment {
  readonly dispatchRemote?: RemoteTaskDispatcher;
  readonly revision: string;
  readonly services: ReadonlyMap<string, RemoteService>;
}
const identifier = /^[A-Za-z0-9_-]{1,128}$/;
const requestIdentifier = /^[a-f0-9-]{36}$/;
function secret(value: string) {
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(value))
    throw new TypeError(
      "Remote token must contain 32–256 ASCII letters, digits, underscores or hyphens",
    );
  return Buffer.from(`Bearer ${value}`);
}
function duration(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 300000)
    throw new TypeError("Remote timeout must be between 1 and 300000 ms");
  return value;
}
function deploymentSnapshot(deployment: RemoteDeployment): RemoteDeployment {
  if (!identifier.test(deployment.revision))
    throw new TypeError("Invalid deployment revision");
  if (!deployment.services.size || deployment.services.size > 256)
    throw new TypeError("Deployment must register 1–256 services");
  const services = new Map<string, RemoteService>();
  for (const [id, service] of deployment.services) {
    if (
      !identifier.test(id) ||
      !identifier.test(service.exportName) ||
      new URL(service.module).protocol !== "file:"
    )
      throw new TypeError("Invalid registered service");
    if (!service.schemas.length || service.schemas.length > 256)
      throw new TypeError("Invalid service schemas");
    const schemas = service.schemas.map((key) => {
      if (
        typeof key !== "string" ||
        key.length > 16384 ||
        schemaKey(JSON.parse(key)) !== key
      )
        throw new TypeError("Service schema must be canonical");
      return key;
    });
    const copy = {
      module: service.module,
      exportName: service.exportName,
      schemas,
    };
    copyRemoteBinding(service, copy);
    services.set(id, copy);
  }
  return {
    revision: deployment.revision,
    services,
    ...(deployment.dispatchRemote
      ? { dispatchRemote: deployment.dispatchRemote }
      : {}),
  };
}

/** Load trusted local configuration. Module paths are relative to the manifest. */
export async function loadRemoteDeployment(
  path: string,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    endpoints?: ReadonlyMap<string, RemoteEndpoint>;
    workerEnv?: Record<string, string | undefined>;
  } = {},
): Promise<RemoteDeployment> {
  const manifest = await realpath(path);
  const root = dirname(manifest);
  const text = await readFile(manifest, "utf8");
  if (text.length > 1024 * 1024)
    throw new TypeError("Deployment manifest is too large");
  const input = JSON.parse(text) as {
    version?: unknown;
    revision?: unknown;
    services?: unknown;
    captures?: unknown;
    remoteImports?: unknown;
  };
  if (
    input.version !== 1 ||
    typeof input.revision !== "string" ||
    !input.services ||
    typeof input.services !== "object" ||
    Array.isArray(input.services)
  )
    throw new TypeError("Invalid deployment manifest");
  const services = new Map<string, RemoteService>();
  const entries = Object.entries(input.services);
  if (!entries.length || entries.length > 256)
    throw new TypeError("Invalid service count");
  for (const [id, value] of entries) {
    const entry = value as {
      module?: unknown;
      exportName?: unknown;
      schemas?: unknown;
    };
    if (
      !entry ||
      typeof entry.module !== "string" ||
      isAbsolute(entry.module) ||
      entry.module.includes("\\") ||
      !entry.module.endsWith(".mjs") ||
      typeof entry.exportName !== "string" ||
      !Array.isArray(entry.schemas)
    )
      throw new TypeError("Invalid service entry");
    const file = await realpath(resolve(root, entry.module));
    const inside = relative(root, file);
    if (inside === ".." || inside.startsWith("../") || isAbsolute(inside))
      throw new TypeError("Service module escapes deployment directory");
    services.set(id, {
      module: pathToFileURL(file).href,
      exportName: entry.exportName,
      schemas: entry.schemas,
    });
  }
  let dispatchRemote: RemoteTaskDispatcher | undefined;
  if (input.remoteImports !== undefined) {
    if (
      typeof input.remoteImports !== "string" ||
      isAbsolute(input.remoteImports) ||
      input.remoteImports.includes("\\")
    )
      throw new TypeError("Invalid remote import manifest path");
    const imports = await realpath(resolve(root, input.remoteImports));
    const inside = relative(root, imports);
    if (inside === ".." || inside.startsWith("../") || isAbsolute(inside))
      throw new TypeError(
        "Remote import manifest escapes deployment directory",
      );
    if (!options.endpoints)
      throw new TypeError(
        "Service remote imports require host endpoint bindings",
      );
    dispatchRemote = await loadRemoteImportDispatcher(
      imports,
      options.endpoints,
    );
  } else if (options.endpoints) {
    throw new TypeError(
      "Endpoint bindings supplied for a service with no remote imports",
    );
  }
  const deployment = deploymentSnapshot({
    revision: input.revision,
    services,
    ...(dispatchRemote ? { dispatchRemote } : {}),
  });
  const capturePlan = await validateCapturePlan(
    input.captures,
    root,
    deployment.services,
  );
  // All paths and schemas are checked before trusted generated modules are loaded.
  for (const service of deployment.services.values()) {
    const module = await import(service.module);
    const declared = module.__kalandraSchemas?.[service.exportName];
    if (
      typeof module[service.exportName] !== "function" ||
      !Array.isArray(declared) ||
      serviceWorkerSchemas(service, capturePlan).some(
        (key) => !declared.includes(key),
      )
    )
      throw new TypeError("Deployment does not match generated task schemas");
  }
  if (capturePlan) await initializeCaptures(capturePlan, options);
  return deployment;
}

/** Load routes for a copy of the same compiled graph, without importing its code. */
export async function loadRemoteClient(path: string) {
  const manifestPath = await realpath(path);
  const root = dirname(manifestPath);
  const manifest = parseRemoteClientManifest(
    await readFile(manifestPath, "utf8"),
  );
  const routes = new Map<string, string>();
  for (const [id, service] of Object.entries(manifest.services)) {
    const file = await realpath(resolve(root, service.module));
    const inside = relative(root, file);
    if (inside === ".." || inside.startsWith("../") || isAbsolute(inside))
      throw new TypeError("Client module escapes build directory");
    const key = pathToFileURL(file).href + "#" + service.exportName;
    if (routes.has(key)) throw new TypeError("Duplicate client route");
    routes.set(key, id);
  }
  return { revision: manifest.revision, routes, services: manifest.services };
}

export interface RemoteEndpoint {
  readonly url: string;
  readonly token: string;
}
export interface RemoteImportOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  /** Explicit fallback for local tasks; never used for an unknown remote identity. */
  readonly local?: (task: ModuleTask) => Promise<unknown>;
}
/** Bind independently compiled remote imports without loading any server code. */
export type RemoteTaskDispatcher = (
  task: ModuleTask,
  options?: { signal?: CancellationSignal; remoteDepth?: number },
) => Promise<unknown>;
export async function loadRemoteImportDispatcher(
  path: string,
  endpoints: ReadonlyMap<string, RemoteEndpoint>,
  options: RemoteImportOptions = {},
): Promise<RemoteTaskDispatcher> {
  const manifest = parseRemoteImportManifest(await readFile(path, "utf8"));
  for (const key of endpoints.keys())
    if (!Object.hasOwn(manifest.contracts, key))
      throw new TypeError(`Unused remote endpoint binding: ${key}`);
  const dispatchers = new Map<
    string,
    { run: RemoteTaskDispatcher; schemas: readonly string[] }
  >();
  for (const [contract, description] of Object.entries(manifest.contracts)) {
    const endpoint = endpoints.get(contract);
    if (!endpoint)
      throw new TypeError(`Missing remote endpoint binding for ${contract}`);
    const routes = new Map(
      Object.entries(description.services).map(([id, service]) => [
        remoteTaskModule(contract, id) + "#" + service.exportName,
        id,
      ]),
    );
    const run = createRemoteDispatcher({
      url: endpoint.url,
      token: endpoint.token,
      revision: description.revision,
      routes,
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.timeoutMs === undefined
        ? {}
        : { timeoutMs: options.timeoutMs }),
    });
    for (const [id, service] of Object.entries(description.services))
      dispatchers.set(
        remoteTaskModule(contract, id) + "#" + service.exportName,
        { run, schemas: service.schemas },
      );
  }
  const local = options.local;
  return async (task, callOptions) => {
    const dispatcher = dispatchers.get(task.module + "#" + task.exportName);
    if (dispatcher) {
      if (!task.schema || !dispatcher.schemas.includes(schemaKey(task.schema)))
        throw new TypeError(
          "Remote task schema does not match its compiled contract",
        );
      return dispatcher.run(task, callOptions);
    }
    if (local && !task.module.startsWith("kalandra-remote:"))
      return local(task);
    throw new TypeError("No dispatcher registered for task");
  };
}

export async function readRemoteBody(
  message: Request | Response,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const reader = message.body?.getReader();
  if (!reader) throw new Error("Missing frame");
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    signal?.throwIfAborted();
    while (true) {
      const item = await reader.read();
      signal?.throwIfAborted();
      if (item.done) break;
      length += item.value.length;
      if (length > maxRemoteFrameBytes)
        throw new Error("Frame exceeds network limit");
      chunks.push(item.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export class RemoteCleanupError extends Error {}

interface Reservation {
  clean: boolean;
  controller: AbortController;
  started: boolean;
  done: Promise<void>;
  finish(): void;
  timer: ReturnType<typeof setTimeout>;
}
/** run must settle only after its worker resources have been reaped. */
export function createRemoteHandler(config: {
  deployment: RemoteDeployment;
  token: string;
  taskTimeoutMs?: number;
  bodyTimeoutMs?: number;
  maxConcurrent?: number;
  run(
    task: ModuleTask,
    options: TaskOptions & { remoteDepth: number },
  ): Promise<unknown>;
}) {
  const deployment = deploymentSnapshot(config.deployment);
  const authorization = secret(config.token);
  const taskTimeoutMs = duration(config.taskTimeoutMs ?? 30000);
  const bodyTimeoutMs = duration(config.bodyTimeoutMs ?? 5000);
  const maximum = config.maxConcurrent ?? 8;
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 64)
    throw new TypeError("Invalid remote concurrency");
  const active = new Map<string, Reservation>();
  const completed = new Map<string, number>();
  let closed = false;
  let cleanupFailed = false;
  function finish(id: string, state: Reservation) {
    clearTimeout(state.timer);
    active.delete(id);
    completed.set(id, Date.now() + 30000);
    while (completed.size > 256)
      completed.delete(completed.keys().next().value!);
    state.finish();
  }
  function cancel(id: string, state: Reservation) {
    state.controller.abort();
    if (!state.started) finish(id, state);
    return state.done;
  }
  const fetch = async (request: Request): Promise<Response> => {
    const fail = (status: number, code: string) =>
      new Response(code, { status });
    const supplied = Buffer.from(request.headers.get("authorization") ?? "");
    if (
      supplied.length !== authorization.length ||
      !timingSafeEqual(supplied, authorization)
    )
      return fail(401, "UNAUTHORIZED");
    if (closed) return fail(503, "CLOSED");
    const route = new URL(request.url).pathname;
    if (
      request.method !== "POST" ||
      !["/v2/reserve", "/v2/call", "/v2/cancel"].includes(route)
    )
      return fail(404, "NOT_FOUND");
    if (request.headers.get("x-kalandra-network") !== remoteNetworkVersion)
      return fail(409, "PROTOCOL_MISMATCH");
    if (request.headers.get("x-kalandra-revision") !== deployment.revision)
      return fail(409, "REVISION_MISMATCH");
    const depthText = request.headers.get("x-kalandra-depth") ?? "0";
    if (!/^(0|[1-9][0-9]*)$/.test(depthText) || Number(depthText) > 32)
      return fail(400, "REMOTE_NESTING_LIMIT");
    const remoteDepth = Number(depthText);
    const id = request.headers.get("x-kalandra-request") ?? "";
    if (!requestIdentifier.test(id)) return fail(400, "INVALID_REQUEST_ID");
    for (const [key, expires] of completed)
      if (expires <= Date.now()) completed.delete(key);
    if (route === "/v2/reserve") {
      if (active.has(id) || completed.has(id))
        return fail(409, "DUPLICATE_REQUEST");
      if (active.size >= maximum) return fail(503, "BUSY");
      let settle!: () => void;
      const state: Reservation = {
        clean: true,
        controller: new AbortController(),
        started: false,
        done: new Promise<void>((resolve) => {
          settle = resolve;
        }),
        finish: () => settle(),
        timer: undefined as unknown as ReturnType<typeof setTimeout>,
      };
      state.timer = setTimeout(() => {
        void cancel(id, state);
      }, bodyTimeoutMs + taskTimeoutMs);
      active.set(id, state);
      return new Response(null, { status: 201 });
    }
    const state = active.get(id);
    if (route === "/v2/cancel") {
      if (state) {
        await cancel(id, state);
        if (!state.clean) return fail(503, "CLEANUP_UNCONFIRMED");
      } else if (!completed.has(id)) return fail(404, "UNKNOWN_REQUEST");
      return new Response(null, { status: 204 });
    }
    if (!state || state.started || state.controller.signal.aborted)
      return fail(409, "NOT_RESERVED");
    state.started = true;
    const abort = () => state.controller.abort();
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) abort();
    try {
      if (request.headers.get("content-type") !== remoteMediaType)
        return fail(415, "CONTENT_TYPE");
      let call: CallFrame;
      try {
        call = decodeCall(
          await readRemoteBody(
            request,
            AbortSignal.any([
              state.controller.signal,
              AbortSignal.timeout(bodyTimeoutMs),
            ]),
          ),
        );
      } catch {
        return fail(400, "INVALID_FRAME");
      }
      if (state.controller.signal.aborted) return fail(409, "CANCELLED");
      if (
        call.parentId ||
        Object.keys(remoteLimits).some(
          (key) =>
            call.limits[key as keyof CodecLimits] !==
            remoteLimits[key as keyof CodecLimits],
        )
      )
        return fail(400, "INVALID_LIMITS_OR_PARENT");
      const service = deployment.services.get(call.task.module);
      if (!service || service.exportName !== call.task.exportName)
        return fail(404, "UNKNOWN_SERVICE");
      if (!service.schemas.includes(schemaKey(call.task.schema)))
        return fail(409, "SCHEMA_MISMATCH");
      let reply: Uint8Array;
      try {
        const value = await config.run(
          bindRemoteTask(service, {
            ...call.task,
            module: service.module,
          } as ModuleTask),
          {
            timeoutMs: taskTimeoutMs,
            signal: state.controller.signal,
            remoteDepth,
          },
        );
        reply = encodeReply(call, { kind: "result", id: call.id, value });
      } catch (error) {
        if (error instanceof RemoteCleanupError) {
          state.clean = false;
          cleanupFailed = true;
          closed = true;
          return fail(503, "CLEANUP_UNCONFIRMED");
        }
        reply = encodeReply(call, {
          kind: "failure",
          id: call.id,
          error: {
            name: "RemoteTaskError",
            message: (error instanceof Error
              ? error.message
              : String(error)
            ).slice(0, 2000),
          },
        });
      }
      return new Response(new Uint8Array(reply).buffer, {
        headers: {
          "content-type": remoteMediaType,
          "x-kalandra-network": remoteNetworkVersion,
          "x-kalandra-revision": deployment.revision,
        },
      });
    } finally {
      request.signal.removeEventListener("abort", abort);
      finish(id, state);
    }
  };
  return {
    fetch,
    get activeRequests() {
      return active.size;
    },
    async close() {
      closed = true;
      await Promise.all([...active].map(([id, state]) => cancel(id, state)));
      if (cleanupFailed)
        throw new RemoteCleanupError("Worker cleanup is unconfirmed");
    },
  };
}

export interface RemoteClientOptions {
  url: string;
  revision: string;
  token: string;
  routes: ReadonlyMap<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  fetch?: (url: URL, options: RequestInit) => Promise<Response>;
}
export function createRemoteDispatcher(config: RemoteClientOptions) {
  secret(config.token);
  const base = new URL(config.url);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    (base.protocol !== "https:" &&
      !(
        base.protocol === "http:" &&
        ["127.0.0.1", "[::1]"].includes(base.hostname)
      ))
  )
    throw new TypeError(
      "Remote endpoints require HTTPS, except numeric loopback HTTP",
    );
  if (!identifier.test(config.revision))
    throw new TypeError("Invalid deployment revision");
  const routes = new Map(config.routes);
  const timeoutMs = duration(config.timeoutMs ?? 35000);
  const send = config.fetch ?? fetch;
  let id = 0;
  return async (
    task: ModuleTask,
    options: { signal?: CancellationSignal; remoteDepth?: number } = {},
  ): Promise<unknown> => {
    const remoteDepth = options.remoteDepth ?? 0;
    if (!Number.isInteger(remoteDepth) || remoteDepth < 0 || remoteDepth > 32)
      throw new Error("Remote service nesting limit exceeded");
    config.signal?.throwIfAborted();
    if (options.signal?.aborted) throw new Error("Remote call cancelled");
    if (!task.schema)
      throw new Error("Remote calls require a concrete Sia schema");
    const service = routes.get(task.module + "#" + task.exportName);
    if (!service) throw new Error("No remote service registered for task");
    const call: CallFrame = {
      kind: "call",
      id: ++id,
      limits: remoteLimits,
      task: { ...task, module: service, schema: task.schema },
    };
    const body = new Uint8Array(encodeCall(call)).buffer;
    const headers = {
      authorization: `Bearer ${config.token}`,
      "x-kalandra-network": remoteNetworkVersion,
      "x-kalandra-revision": config.revision,
      "x-kalandra-request": crypto.randomUUID(),
      "x-kalandra-depth": String(remoteDepth),
    };
    const control = async (route: string) => {
      const response = await send(new URL(route, base), {
        method: "POST",
        redirect: "error",
        headers,
        signal: AbortSignal.timeout(5000),
      });
      await response.body?.cancel();
      return response.status;
    };
    const reserved = await control("/v2/reserve");
    if (reserved !== 201)
      throw new Error(`Remote reservation rejected (HTTP ${reserved})`);
    const controller = new AbortController();
    const callController = new AbortController();
    const abortCall = () => callController.abort();
    options.signal?.addEventListener("abort", abortCall, { once: true });
    if (options.signal?.aborted) abortCall();
    const signal = AbortSignal.any([
      AbortSignal.timeout(timeoutMs),
      ...(config.signal ? [config.signal] : []),
      callController.signal,
    ]);
    let cancelling: Promise<void> | undefined;
    const cancel = () =>
      (cancelling ??= (async () => {
        try {
          if ((await control("/v2/cancel")) !== 204)
            throw new Error("Cancellation acknowledgement missing");
        } catch {
          throw Object.assign(
            new Error(
              "Remote cancellation unconfirmed; execution outcome is unknown",
            ),
            { code: "REMOTE_CLEANUP_FAILED" },
          );
        } finally {
          controller.abort();
        }
      })());
    const abort = () => {
      void cancel().catch(() => {});
    };
    signal.addEventListener("abort", abort, { once: true });
    try {
      if (signal.aborted) {
        await cancel();
        throw new Error("Remote call cancelled");
      }
      const response = await send(new URL("/v2/call", base), {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: { ...headers, "content-type": remoteMediaType },
        body,
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Remote call rejected (HTTP ${response.status})`);
      }
      if (
        response.headers.get("content-type") !== remoteMediaType ||
        response.headers.get("x-kalandra-network") !== remoteNetworkVersion ||
        response.headers.get("x-kalandra-revision") !== config.revision
      ) {
        await response.body?.cancel();
        throw new Error("Invalid remote response headers");
      }
      const reply = decodeReply(
        await readRemoteBody(response, controller.signal),
        call,
      );
      if (signal.aborted) {
        await cancel();
        throw new Error("Remote call cancelled");
      }
      if (reply.kind === "failure")
        throw new Error(`Remote task failed: ${reply.error.message}`);
      return reply.value;
    } catch (error) {
      await cancel();
      if (signal.aborted) throw new Error("Remote call cancelled");
      throw error;
    } finally {
      signal.removeEventListener("abort", abort);
      options.signal?.removeEventListener("abort", abortCall);
    }
  };
}

/** Loopback listener; place behind a trusted TLS endpoint for cross-host use. */
export function serveRemoteTasks(config: {
  workerEnv?: Record<string, string | undefined>;
  deployment: RemoteDeployment;
  token: string;
  port?: number;
  taskTimeoutMs?: number;
  maxConcurrent?: number;
  bodyTimeoutMs?: number;
}) {
  const pools = new Set<ReturnType<typeof createBunWorkerPool>>();
  const handler = createRemoteHandler({
    ...config,
    async run(task, options) {
      const pool = createBunWorkerPool({
        maxWorkers: 1,
        maxQueuedTasks: 8,
        valueLimits: remoteLimits,
        ...(config.workerEnv ? { workerEnv: config.workerEnv } : {}),
        ...(config.deployment.dispatchRemote
          ? {
              dispatchRemote: (task, signal) =>
                config.deployment.dispatchRemote!(task, {
                  signal,
                  remoteDepth: options.remoteDepth + 1,
                }),
            }
          : {}),
      });
      pools.add(pool);
      try {
        return await pool.run(task, options);
      } finally {
        try {
          await pool.close();
        } catch {
          throw new RemoteCleanupError("Worker cleanup is unconfirmed");
        }
        pools.delete(pool);
      }
    },
  });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: config.port ?? 0,
    maxRequestBodySize: maxRemoteFrameBytes,
    fetch: handler.fetch,
  });
  return {
    url: server.url.href,
    get activeRequests() {
      return handler.activeRequests;
    },
    get workers() {
      return [...pools].reduce((n, pool) => n + pool.stats.workers, 0);
    },
    async close() {
      try {
        await handler.close();
      } finally {
        await server.stop(true);
      }
    },
  };
}
