import { verifyRemoteWorkflow } from "../tests/helpers/workflow-cli.js";
import assert from "node:assert/strict";
import { cp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

export async function verifyRemoteCli(config: {
  runtimeUrl: string;
  root: string;
  deployment: string;
  contract: string;
  token: string;
  url: string;
  stats: () => Promise<{ workers: number; activeRequests: number }>;
  built: boolean;
}) {
  const { root, token } = config;
  if (config.built)
    await cp("dist/cli", join(root, "cli"), { recursive: true });
  const cli = config.built
    ? join(root, "cli/index.js")
    : resolve("packages/cli/src/index.ts");
  await verifyRemoteWorkflow(cli, root);
  const directory = join(root, "cli-source");
  await mkdir(directory);
  await cp(config.contract, join(directory, "math.client.json"));
  const bindings = join(directory, "endpoints.json");
  const writeBindings = (url: string) =>
    Bun.write(
      bindings,
      JSON.stringify({
        version: 1,
        endpoints: {
          "math.client.json": { url, tokenEnv: "CLI_REMOTE_TOKEN" },
        },
      }),
    );
  await writeBindings(config.url);
  const source = join(directory, "main.kalandra");
  const spawn = (args: string[]) =>
    Bun.spawn([process.execPath, cli, ...args], {
      cwd: root,
      env: { ...process.env, CLI_REMOTE_TOKEN: token },
      stdout: "pipe",
      stderr: "pipe",
    });
  const finish = async (child: ReturnType<typeof spawn>) => {
    const timeout = setTimeout(() => child.kill("SIGKILL"), 15000);
    try {
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      assert.ok(
        !stdout.includes(token) && !stderr.includes(token),
        "CLI leaked token",
      );
      return { code, stdout, stderr };
    } finally {
      clearTimeout(timeout);
    }
  };
  const run = () => spawn(["run", source, "--strict", "--bindings", bindings]);
  const success =
    'from "remote:./math.client.json" import calculate capturedCalculate NamedPoint echoNamed\n@params NamedPoint\n@returns NamedPoint\nfn typed value: await echoNamed value\n@params Number\nfn local n: await calculate n\nexport fn main:\n  [(await calculate 1.5) (await |local| 4) (await capturedCalculate 1.5) (await |typed| (NamedPoint "worker" 1.5 2.5))]\n';
  await Bun.write(source, success);
  let result = await finish(run());
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /3\.25/);
  assert.match(result.stdout, /8\.25/);
  assert.match(result.stdout, /worker/);

  await Bun.write(
    source,
    'from "remote:./math.client.json" import slow broken\n@params Number\nfn work n:\n  pending = slow 45\n  await broken n\nexport fn main: await |work| 1\n',
  );
  result = await finish(run());
  assert.equal(result.code, 1, result.stderr);
  assert.deepEqual(await config.stats(), { workers: 0, activeRequests: 0 });

  await Bun.write(
    source,
    'from "remote:./math.client.json" import slow\n@params Number\nfn work n: await slow n\nexport fn main: await |work| 45\n',
  );
  const cancelled = run();
  const cancellation = finish(cancelled);
  try {
    const started = Date.now();
    while ((await config.stats()).workers === 0) {
      assert.ok(
        Date.now() - started < 10000,
        "CLI remote worker never started",
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    cancelled.kill("SIGINT");
    assert.equal((await cancellation).code, 130);
    assert.deepEqual(await config.stats(), { workers: 0, activeRequests: 0 });
  } finally {
    if (cancelled.exitCode === null) cancelled.kill("SIGKILL");
    await cancellation;
  }

  // A separately compiled relay service calls the already-running base service.
  const relaySource = join(directory, "relay.kalandra");
  await Bun.write(
    relaySource,
    `from "remote:./math.client.json" import calculate slow broken
@params Function Number
fn invoke f n: await f n
fn choose: calculate
@params Number
fn make offset:
  @params Number
  fn inner n: n + offset
  inner
startup = make 1
@params Number
export fn closure n: await |startup| n
@params Number
export fn relay n:
  chosen = choose ()
  await invoke chosen n
@params Number
export fn nested n: await |relay| n
fn chooseSlow: slow
@params Number
export fn wait n:
  chosen = chooseSlow ()
  await chosen n
@params Number
export fn fail n:
  waiting = slow
  failing = broken
  pending = waiting 45
  await failing n
`,
  );
  const relayOut = join(root, "relay-out");
  const builtRelay = await finish(
    spawn([
      "build",
      relaySource,
      "--strict",
      "-o",
      relayOut,
      ...["relay", "nested", "wait", "fail", "closure"].flatMap((name) => [
        "--service",
        `${name}=${name}`,
      ]),
    ]),
  );
  assert.equal(builtRelay.code, 0, builtRelay.stderr);
  const relayDeployment = join(relayOut, "kalandra.deployment.json");
  const missing = await finish(
    spawn(["serve", relayDeployment, "--token-env", "CLI_REMOTE_TOKEN"]),
  );
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /endpoint bindings/);
  await writeBindings(config.url);
  const relayHost = spawn([
    "serve",
    relayDeployment,
    "--token-env",
    "CLI_REMOTE_TOKEN",
    "--bindings",
    bindings,
  ]);
  const relayErrors = new Response(relayHost.stderr).text();
  const relayReader = relayHost.stdout.getReader();
  const relayTimer = setTimeout(() => relayHost.kill("SIGKILL"), 30000);
  try {
    let output = "";
    while (!output.includes("\n")) {
      const chunk = await relayReader.read();
      assert.ok(
        !chunk.done,
        await (relayHost.exitCode === null
          ? Promise.resolve(output)
          : relayErrors),
      );
      output += new TextDecoder().decode(chunk.value);
    }
    const relayUrl = /Listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(
      output,
    )?.[1];
    assert.ok(relayUrl, output);
    await cp(
      join(relayOut, "kalandra.client.json"),
      join(directory, "relay.client.json"),
    );
    const relayBindings = join(directory, "relay-endpoints.json");
    await Bun.write(
      relayBindings,
      JSON.stringify({
        version: 1,
        endpoints: {
          "relay.client.json": { url: relayUrl, tokenEnv: "CLI_REMOTE_TOKEN" },
        },
      }),
    );
    const chainSource = join(directory, "chain.kalandra");
    const chainRun = () =>
      spawn(["run", chainSource, "--strict", "--bindings", relayBindings]);
    const relayWorkers = () => {
      const result = Bun.spawnSync(["ps", "-ax", "-o", "pid=", "-o", "ppid="], {
        timeout: 3000,
      });
      assert.equal(result.exitCode, 0);
      return result.stdout
        .toString()
        .trim()
        .split("\n")
        .map((line) => line.trim().split(/\s+/).map(Number))
        .filter(([, parent]) => parent === relayHost.pid);
    };
    const checkChain = async () => {
      await Bun.write(
        chainSource,
        'from "remote:./relay.client.json" import relay nested closure\nexport fn main:\n  direct = relay\n  indirect = nested\n  [(await direct 1.5) (await indirect 4) (await closure 5)]\n',
      );
      const result = await finish(chainRun());
      assert.equal(result.code, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), [3.25, 8.25, 6]);
      assert.deepEqual(await config.stats(), { workers: 0, activeRequests: 0 });
      assert.equal(
        relayWorkers().length,
        0,
        "relay workers remained after settlement",
      );
    };
    await checkChain();
    const { loadRemoteClient, createRemoteDispatcher } = (await import(
      config.runtimeUrl
    )) as typeof import("../packages/runtime/hosts/bun/remote.js");
    const relayClient = await loadRemoteClient(
      join(relayOut, "kalandra.client.json"),
    );
    const relayService = relayClient.services.relay!;
    const relayRoute = [...relayClient.routes].find(
      ([, id]) => id === "relay",
    )![0];
    const boundaryCall = createRemoteDispatcher({
      url: relayUrl,
      token,
      revision: relayClient.revision,
      routes: relayClient.routes,
    });
    const boundaryTask = {
      module: relayRoute.slice(0, relayRoute.lastIndexOf("#")),
      exportName: relayService.exportName,
      args: [1.5],
      schema: relayService.signature,
    };
    assert.equal(await boundaryCall(boundaryTask, { remoteDepth: 31 }), 3.25);
    await assert.rejects(
      boundaryCall(boundaryTask, { remoteDepth: 32 }),
      /nesting limit/,
    );
    assert.deepEqual(await config.stats(), { workers: 0, activeRequests: 0 });
    assert.equal(relayWorkers().length, 0);
    await Bun.write(
      chainSource,
      'from "remote:./relay.client.json" import fail\nexport fn main: await fail 1\n',
    );
    const failure = await finish(chainRun());
    assert.equal(failure.code, 1, failure.stderr);
    assert.deepEqual(await config.stats(), { workers: 0, activeRequests: 0 });
    assert.equal(
      relayWorkers().length,
      0,
      "relay workers remained after settlement",
    );
    await checkChain();
    await Bun.write(
      chainSource,
      'from "remote:./relay.client.json" import wait\nexport fn main: await wait 45\n',
    );
    const child = chainRun();
    const completed = finish(child);
    try {
      const deadline = Date.now() + 10000;
      while ((await config.stats()).workers === 0) {
        assert.ok(
          Date.now() < deadline,
          "downstream chain worker never started",
        );
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      child.kill("SIGINT");
      assert.equal((await completed).code, 130);
      assert.deepEqual(await config.stats(), { workers: 0, activeRequests: 0 });
      assert.equal(
        relayWorkers().length,
        0,
        "relay workers remained after settlement",
      );
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      await completed;
    }
    await checkChain();
    relayHost.kill("SIGTERM");
    assert.equal(await relayHost.exited, 0, await relayErrors);
    await assert.rejects(fetch(relayUrl));
  } finally {
    clearTimeout(relayTimer);
    relayReader.releaseLock();
    if (relayHost.exitCode === null) relayHost.kill("SIGKILL");
    await relayHost.exited;
  }

  const hosted = spawn([
    "serve",
    config.deployment,
    "--token-env",
    "CLI_REMOTE_TOKEN",
    "--port",
    "0",
  ]);
  const errors = new Response(hosted.stderr).text();
  const reader = hosted.stdout.getReader();
  const timer = setTimeout(() => hosted.kill("SIGKILL"), 15000);
  try {
    let output = "";
    while (!output.includes("\n")) {
      const chunk = await reader.read();
      assert.ok(!chunk.done, "CLI server exited before readiness");
      output += new TextDecoder().decode(chunk.value);
    }
    const url = /Listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(output)?.[1];
    assert.ok(url, output);
    assert.ok(!output.includes(token));
    await writeBindings(url);
    await Bun.write(source, success);
    result = await finish(run());
    assert.equal(result.code, 0, result.stderr);
    hosted.kill("SIGTERM");
    assert.equal(await hosted.exited, 0, await errors);
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
    if (hosted.exitCode === null) hosted.kill("SIGKILL");
    await hosted.exited;
  }
  console.log(
    "Remote CLI acceptance passed: mixed local/remote calls, service chaining and nested calls, failure cleanup, SIGINT cancellation and graceful service shutdown.",
  );
}
