import { mkdtemp, rm } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createBunWorkerPool } from "@kalandra/runtime/bun";
import {
  loadRemoteImportDispatcher,
  type RemoteTaskDispatcher,
} from "@kalandra/runtime/bun/remote";
import type { ModuleTask } from "@kalandra/runtime";
import { buildProject } from "./build.js";
import { parseBindings } from "./remote.js";

export async function runProject(
  entry: string,
  strict: boolean,
  args: string[],
  bindingsPath?: string,
) {
  const directory = await mkdtemp(join(tmpdir(), "kalandra-run-"));
  const controller = new AbortController();
  let signalCode = 0;
  const interrupt = () => {
    signalCode = 130;
    controller.abort();
  };
  const terminate = () => {
    signalCode = 143;
    controller.abort();
  };
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  let remoteDispatch: RemoteTaskDispatcher | undefined;
  const workerEnv = { ...process.env };
  const pool = createBunWorkerPool({
    workerEnv,
    dispatchRemote: (task, signal) => {
      if (!remoteDispatch)
        throw new Error("Remote child tasks require host endpoint bindings");
      return remoteDispatch(task, { signal });
    },
    maxWorkers: Math.min(4, availableParallelism()),
    maxQueuedTasks: 1024,
  });
  const pending = new Set<Promise<unknown>>();
  let cleanupUnconfirmed = false;
  try {
    const runner = await buildProject(entry, directory, strict, true);
    if (!runner || controller.signal.aborted) return;
    const manifest = join(directory, "kalandra.remotes.json");
    const remote = await Bun.file(manifest).exists();
    const local = (task: ModuleTask) => {
      if (!task.schema)
        throw new Error("Compiled parallel tasks require a Sia schema");
      return pool.run(task, { timeoutMs: 30000, signal: controller.signal });
    };
    let dispatch: (task: ModuleTask) => Promise<unknown> = local;
    if (remote) {
      if (!bindingsPath)
        throw new Error(
          "Remote imports require host endpoint bindings; supply --bindings endpoints.json",
        );
      const bindingText = await Bun.file(bindingsPath).text();
      const endpoints = parseBindings(bindingText);
      for (const endpoint of Object.values(
        JSON.parse(bindingText).endpoints,
      ) as { tokenEnv: string }[])
        delete workerEnv[endpoint.tokenEnv];
      const contracts = (await Bun.file(manifest).json()).contracts;
      for (const key of endpoints.keys())
        if (!Object.hasOwn(contracts, key))
          throw new Error(`Unused remote endpoint binding: ${key}`);
      dispatch = remoteDispatch = await loadRemoteImportDispatcher(
        manifest,
        endpoints,
        {
          local,
          signal: controller.signal,
        },
      );
    } else if (bindingsPath) {
      throw new Error(
        "Endpoint bindings supplied for a program with no remote imports",
      );
    }
    if (controller.signal.aborted) return;
    const program = await import(pathToFileURL(runner).href);
    if (controller.signal.aborted) return;
    const result = await program.run(
      (task: ModuleTask) => {
        const promise = Promise.resolve().then(() => {
          controller.signal.throwIfAborted();
          return dispatch(task);
        });
        pending.add(promise);
        void promise.then(
          () => pending.delete(promise),
          (error) => {
            pending.delete(promise);
            if (
              error instanceof Error &&
              error.message.includes("cancellation unconfirmed")
            )
              cleanupUnconfirmed = true;
          },
        );
        return promise;
      },
      "main",
      [args],
    );
    if (!controller.signal.aborted && result !== undefined) console.log(result);
  } catch (error) {
    console.error(
      `Cannot run program: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  } finally {
    controller.abort();
    await Promise.allSettled([...pending]);
    try {
      await pool.close();
    } catch (error) {
      console.error(`Cannot confirm task cleanup: ${String(error)}`);
      cleanupUnconfirmed = true;
    } finally {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", terminate);
      await rm(directory, { recursive: true, force: true });
    }
    if (signalCode) process.exitCode = signalCode;
    if (cleanupUnconfirmed) {
      console.error(
        "Remote cancellation unconfirmed; execution outcome is unknown",
      );
      process.exitCode = 1;
    }
  }
}
