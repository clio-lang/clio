import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  copySchema,
  schemaKey,
  type TaskSchema,
} from "../../../protocol/src/schema.js";
import type { RemoteCaptureManifest } from "../../../protocol/src/remote-contract.js";
import { createBunWorkerPool } from "./index.js";
import type { ModuleTask } from "../../src/index.js";
import type { RemoteService } from "./remote.js";

const privateBindings = new WeakMap<
  RemoteService,
  { schemas: ReadonlyMap<string, TaskSchema>; values: ModuleTask["args"] }
>();
export function copyRemoteBinding(from: RemoteService, to: RemoteService) {
  const value = privateBindings.get(from);
  if (value) privateBindings.set(to, value);
}
export function bindRemoteTask(
  service: RemoteService,
  task: ModuleTask,
): ModuleTask {
  const binding = privateBindings.get(service);
  if (!binding) return task;
  const schema = task.schema
    ? binding.schemas.get(schemaKey(task.schema))
    : undefined;
  if (!schema) throw new Error("Unregistered captured service schema");
  return {
    ...task,
    schema,
    args: [...structuredClone(binding.values), ...task.args],
  };
}

/** Validate the entire private plan without evaluating deployment code. */
export async function validateCapturePlan(
  input: unknown,
  root: string,
  services: ReadonlyMap<string, RemoteService>,
) {
  if (input === undefined) return;
  const plan = input as RemoteCaptureManifest;
  if (
    !plan ||
    !plan.bootstrap ||
    typeof plan.bootstrap.module !== "string" ||
    !plan.bootstrap.module.endsWith(".mjs") ||
    plan.bootstrap.module.includes("\\") ||
    isAbsolute(plan.bootstrap.module) ||
    !plan.bindings ||
    typeof plan.bindings !== "object" ||
    Array.isArray(plan.bindings)
  )
    throw new Error("Invalid remote capture plan");
  const path = await realpath(resolve(root, plan.bootstrap.module));
  const inside = relative(root, path);
  if (inside === ".." || inside.startsWith("../") || isAbsolute(inside))
    throw new Error("Bootstrap module escapes deployment directory");
  const schema = copySchema(plan.bootstrap.schema);
  if (
    schema.args.length ||
    typeof schema.result === "string" ||
    !("record" in schema.result) ||
    schema.result.record.id !== "kalandra:remote-capture-baseline"
  )
    throw new Error("Invalid bootstrap schema");
  const fields = schema.result.record.fields;
  if (!fields.length || fields.some(([name], index) => name !== "c" + index))
    throw new Error("Invalid bootstrap capture fields");
  const entries = Object.entries(plan.bindings);
  if (!entries.length || entries.length > services.size)
    throw new Error("Invalid capture binding count");
  const bindings = entries.map(([id, binding]) => {
    const service = services.get(id);
    if (
      !service ||
      !binding ||
      !Array.isArray(binding.indices) ||
      !binding.indices.length ||
      new Set(binding.indices).size !== binding.indices.length ||
      binding.indices.some(
        (index) =>
          !Number.isInteger(index) || index < 0 || index >= fields.length,
      )
    )
      throw new Error("Invalid capture binding indices");
    const internal = copySchema(binding.schema);
    const captures = binding.indices.map((index) => fields[index]![1]);
    const publicSchema = copySchema({
      args: internal.args.slice(captures.length),
      result: internal.result,
    });
    if (
      !service.schemas.includes(schemaKey(publicSchema)) ||
      schemaKey(internal) !==
        schemaKey({
          args: [...captures, ...publicSchema.args],
          result: publicSchema.result,
        })
    )
      throw new Error("Capture binding does not match public schema");
    const schemas = new Map(
      service.schemas.map((key) => {
        const schema = copySchema(JSON.parse(key));
        if (
          schemaKey({ args: [], result: schema.result }) !==
          schemaKey({ args: [], result: internal.result })
        )
          throw new Error(
            "Capture binding result does not match public schema",
          );
        return [
          key,
          copySchema({
            args: [...captures, ...schema.args],
            result: schema.result,
          }),
        ] as const;
      }),
    );
    return { service, schemas, indices: [...binding.indices] };
  });
  return { module: pathToFileURL(path).href, schema, bindings };
}
export async function initializeCaptures(
  plan: NonNullable<Awaited<ReturnType<typeof validateCapturePlan>>>,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    workerEnv?: Record<string, string | undefined>;
  },
) {
  const pool = createBunWorkerPool({
    ...(options.workerEnv ? { workerEnv: options.workerEnv } : {}),
    maxWorkers: 1,
    maxQueuedTasks: 0,
    valueLimits: { maxDataBytes: 1048576, maxDepth: 64, maxNodes: 10000 },
  });
  try {
    const baseline = await pool.run(
      {
        module: plan.module,
        exportName: "initialize",
        args: [],
        schema: plan.schema,
      },
      {
        timeoutMs: options.timeoutMs ?? 30000,
        ...(options.signal ? { signal: options.signal } : {}),
      },
    );
    const fields = (baseline as { fields: Record<string, unknown> }).fields;
    for (const binding of plan.bindings)
      privateBindings.set(binding.service, {
        schemas: binding.schemas,
        values: binding.indices.map(
          (index) => fields["c" + index],
        ) as ModuleTask["args"],
      });
  } finally {
    await pool.close();
  }
}
export function serviceWorkerSchemas(
  service: RemoteService,
  plan?: Awaited<ReturnType<typeof validateCapturePlan>>,
) {
  const binding = plan?.bindings.find((binding) => binding.service === service);
  return binding
    ? [...binding.schemas.values()].map(schemaKey)
    : service.schemas;
}
