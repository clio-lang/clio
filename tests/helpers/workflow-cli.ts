import assert from "node:assert/strict";
import { cp } from "node:fs/promises";
import { join, resolve } from "node:path";

export const workflowResults = {
  invoices: [35.91, 18],
  "local-batch": [12, 22, 12, 22, 10],
  "remote-batch": [12, 22, 12, 22],
};
const fixtures = resolve("examples/workflows");

export async function verifyLocalWorkflows(cli: string, directory: string) {
  for (const name of ["invoices", "local-batch"] as const) {
    const root = join(directory, "workflows", name);
    await cp(join(fixtures, name), root, { recursive: true });
    if (name === "invoices") {
      const installed = Bun.spawnSync(
        [process.execPath, "install", "--offline", "--ignore-scripts"],
        {
          cwd: root,
          timeout: 15000,
          env: {
            ...process.env,
            BUN_INSTALL_CACHE_DIR: join(root, ".bun-cache"),
            TMPDIR: directory,
          },
        },
      );
      assert.equal(installed.exitCode, 0, installed.stderr.toString());
    }
    for (const command of ["build", "run"]) {
      const args = command === "build" ? ["-o", "out"] : [];
      const result = Bun.spawnSync(
        [process.execPath, cli, command, "main.kalandra", "--strict", ...args],
        { cwd: root, timeout: 15000 },
      );
      assert.equal(result.exitCode, 0, result.stderr.toString());
      assert.ok(result.signalCode == null);
      if (command === "run")
        assert.deepEqual(
          JSON.parse(result.stdout.toString()),
          workflowResults[name],
        );
    }
  }
}

/** Real CLI hosting and clients; no workspace dependencies or generated fixture strings. */
export async function verifyRemoteWorkflow(cli: string, directory: string) {
  const root = join(directory, "remote-workflow");
  await cp(join(fixtures, "remote-batch"), root, { recursive: true });
  const token = crypto.randomUUID().replaceAll("-", "");
  const active = new Set<ReturnType<typeof start>>();
  function start(args: string[]) {
    const child = Bun.spawn([process.execPath, cli, ...args], {
      cwd: root,
      env: { ...process.env, KALANDRA_REMOTE_TOKEN: token },
      stdout: "pipe",
      stderr: "pipe",
    });
    let stdout = "";
    const output = (async () => {
      const reader = child.stdout.getReader();
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          stdout += new TextDecoder().decode(chunk.value);
        }
      } finally {
        reader.releaseLock();
      }
    })();
    const timer = setTimeout(() => child.kill("SIGKILL"), 30000);
    const done = Promise.all([
      child.exited,
      output,
      new Response(child.stderr).text(),
    ])
      .then(([code, , stderr]) => {
        assert.ok(
          !stdout.includes(token) && !stderr.includes(token),
          "workflow leaked endpoint token",
        );
        return { code, stdout, stderr };
      })
      .finally(() => clearTimeout(timer));
    const running = { child, done, stdout: () => stdout };
    active.add(running);
    return running;
  }
  const waitFor = async (
    test: () => boolean | Promise<boolean>,
    label: string,
  ) => {
    const deadline = Date.now() + 10000;
    while (!(await test())) {
      assert.ok(Date.now() < deadline, label);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };
  // Inspect actual worker descendants, so cancellation is verified after work starts.
  function descendants(pid: number): number[] {
    const result = Bun.spawnSync(["ps", "-ax", "-o", "pid=", "-o", "ppid="], {
      timeout: 3000,
    });
    assert.equal(result.exitCode, 0, result.stderr.toString());
    const rows = result.stdout
      .toString()
      .trim()
      .split("\n")
      .map((line) => line.trim().split(/\s+/).map(Number));
    const found = new Set([pid]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [child, parent] of rows)
        if (child && parent && found.has(parent) && !found.has(child)) {
          found.add(child);
          changed = true;
        }
    }
    found.delete(pid);
    return [...found];
  }
  try {
    const built = await start([
      "build",
      "service/main.kalandra",
      "--strict",
      "-o",
      "service-out",
      "--service",
      "calibrate=calibrate",
      "--service",
      "broken=broken",
      "--service",
      "slow=slow",
    ]).done;
    assert.equal(built.code, 0, built.stderr);
    await cp(
      join(root, "service-out/kalandra.client.json"),
      join(root, "client/readings.client.json"),
    );
    const host = start([
      "serve",
      "service-out/kalandra.deployment.json",
      "--port",
      "0",
    ]);
    await waitFor(
      () => host.stdout().includes("Listening on "),
      "workflow host did not become ready",
    );
    const url = /Listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(
      host.stdout(),
    )?.[1];
    assert.ok(url, host.stdout());
    await Bun.write(
      join(root, "client/endpoints.json"),
      JSON.stringify({
        version: 1,
        endpoints: {
          "readings.client.json": { url, tokenEnv: "KALANDRA_REMOTE_TOKEN" },
        },
      }),
    );
    const run = (file: string) =>
      start([
        "run",
        `client/${file}.kalandra`,
        "--strict",
        "--bindings",
        "client/endpoints.json",
      ]);
    const checkSuccess = async () => {
      const result = await run("main").done;
      assert.equal(result.code, 0, result.stderr);
      assert.deepEqual(
        JSON.parse(result.stdout),
        workflowResults["remote-batch"],
      );
      await waitFor(
        () => descendants(host.child.pid).length === 0,
        "workflow workers remained after completion",
      );
    };
    await checkSuccess();
    const failure = await run("failure").done;
    assert.equal(failure.code, 1, failure.stderr);
    assert.match(failure.stderr, /missing is not a function/);
    await waitFor(
      () => descendants(host.child.pid).length === 0,
      "workflow workers remained after failure",
    );
    await checkSuccess();
    const cancel = run("cancel");
    await waitFor(
      () => descendants(host.child.pid).length > 0,
      "no remote worker started before cancellation",
    );
    const workerPids = [
      ...descendants(host.child.pid),
      ...descendants(cancel.child.pid),
    ];
    cancel.child.kill("SIGINT");
    const cancelled = await cancel.done;
    assert.equal(cancelled.code, 130, cancelled.stderr);
    await waitFor(
      () =>
        workerPids.every((pid) => {
          try {
            process.kill(pid, 0);
            return false;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ESRCH") return true;
            throw error;
          }
        }),
      "cancelled workflow workers did not exit",
    );
    await checkSuccess();
    host.child.kill("SIGTERM");
    const closed = await host.done;
    assert.equal(closed.code, 0, closed.stderr);
    await assert.rejects(fetch(url));
  } finally {
    for (const running of active)
      if (running.child.exitCode === null) running.child.kill("SIGTERM");
    const force = setTimeout(() => {
      for (const running of active)
        if (running.child.exitCode === null) running.child.kill("SIGKILL");
    }, 3000);
    try {
      await Promise.allSettled([...active].map((running) => running.done));
    } finally {
      clearTimeout(force);
    }
  }
}
