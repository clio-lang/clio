import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inputState, type WatchInput } from "./watch-inputs.js";

export async function watchProject(
  entry: string,
  output: string,
  strict: boolean,
) {
  entry = resolve(entry);
  output = resolve(output);
  const directory = await mkdtemp(join(tmpdir(), "kalandra-watch-"));
  const report = join(directory, "inputs.json");
  const worker = fileURLToPath(
    new URL(
      import.meta.url.endsWith(".ts")
        ? "./watch-worker.ts"
        : "./watch-worker.js",
      import.meta.url,
    ),
  );
  let stopped = false;
  let wake: (() => void) | undefined;
  const stop = () => {
    stopped = true;
    wake?.();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  const pause = () =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(done, 200);
      function done() {
        clearTimeout(timer);
        wake = undefined;
        resolve();
      }
      wake = done;
    });
  let inputs: WatchInput[] = [];
  let build = true;
  try {
    console.log(`Watching ${entry}. Press Ctrl-C to stop.`);
    while (!stopped) {
      if (build) {
        console.log("Watch: building...");
        await rm(report, { force: true });
        // Finish an active build before shutting down; builds are never overlapped.
        const child = Bun.spawn(
          [process.execPath, worker, entry, output, String(strict), report],
          { stdout: "inherit", stderr: "inherit" },
        );
        await child.exited;
        if (!(await Bun.file(report).exists()))
          throw new Error(
            "Watch compiler stopped without reporting its inputs",
          );
        const result = (await Bun.file(report).json()) as {
          success: boolean;
          inputs: WatchInput[];
        };
        inputs = result.inputs;
        for (const input of inputs)
          if (
            input.kind === "tree" &&
            input.state.startsWith("error:") &&
            !/error:E(NOENT|NOTDIR)$/.test(input.state)
          )
            throw new Error(`Cannot monitor ${input.path}: ${input.state}`);
        console.log(
          result.success
            ? "Watch: build succeeded; waiting for changes."
            : "Watch: build failed; waiting for changes (last successful output retained for compilation errors).",
        );
        build = false;
      }
      if (stopped) break;
      await pause();
      if (stopped) break;
      for (const input of inputs) {
        if (stopped) break;
        if ((await inputState(input, output)) !== input.state) {
          build = true;
          break;
        }
      }
    }
  } catch (error) {
    console.error(
      `Cannot watch project: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await rm(directory, { recursive: true, force: true });
    console.log("Watch stopped.");
  }
}
