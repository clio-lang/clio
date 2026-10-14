import {
  loadRemoteDeployment,
  serveRemoteTasks,
  type RemoteEndpoint,
} from "@kalandra/runtime/bun/remote";

export function environmentToken(name: string, env = process.env): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
    throw new Error("Invalid token environment variable name");
  const token = env[name];
  if (!token || !/^[A-Za-z0-9_-]{32,256}$/.test(token))
    throw new Error(
      `Environment variable ${name} must contain a 32–256 character remote token`,
    );
  return token;
}

export function parseBindings(
  text: string,
  env = process.env,
): Map<string, RemoteEndpoint> {
  if (Buffer.byteLength(text) > 1_048_576)
    throw new Error("Endpoint bindings exceed 1 MiB");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid endpoint bindings JSON");
  }
  if (
    !data ||
    data.version !== 1 ||
    !data.endpoints ||
    typeof data.endpoints !== "object" ||
    Array.isArray(data.endpoints) ||
    Object.keys(data).some((key) => !["version", "endpoints"].includes(key))
  )
    throw new Error(
      "Expected endpoint bindings version 1 with an endpoints object",
    );
  const entries = Object.entries(data.endpoints);
  if (!entries.length || entries.length > 256)
    throw new Error("Expected 1–256 endpoint bindings");
  const result = new Map<string, RemoteEndpoint>();
  for (const [contract, value] of entries) {
    if (
      !contract ||
      contract
        .split("/")
        .some((part) => !part || part === "." || part === "..") ||
      /[\\:\0]/.test(contract)
    )
      throw new Error(
        "Binding keys must be normalized project-relative contract paths",
      );
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).some((key) => !["url", "tokenEnv"].includes(key)) ||
      !("url" in value) ||
      typeof value.url !== "string" ||
      !("tokenEnv" in value) ||
      typeof value.tokenEnv !== "string"
    )
      throw new Error("Each endpoint requires url and tokenEnv only");
    result.set(contract, {
      url: value.url,
      token: environmentToken(value.tokenEnv, env),
    });
  }
  return result;
}

export function serveOptions(args: string[]) {
  const values = new Map<string, string>();
  const allowed = [
    "--bindings",
    "--port",
    "--token-env",
    "--task-timeout-ms",
    "--body-timeout-ms",
    "--max-concurrent",
  ];
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]!;
    if (!allowed.includes(key) || values.has(key) || !args[i + 1])
      throw new Error("Invalid serve options; run bun run cli --help");
    values.set(key, args[i + 1]!);
  }
  const number = (key: string, fallback: number, min: number, max: number) => {
    const text = values.get(key) ?? String(fallback);
    const value = Number(text);
    if (
      !/^\d+$/.test(text) ||
      !Number.isInteger(value) ||
      value < min ||
      value > max
    )
      throw new Error(`${key} must be an integer from ${min} to ${max}`);
    return value;
  };
  return {
    bindingsPath: values.get("--bindings"),
    tokenEnv: values.get("--token-env") ?? "KALANDRA_REMOTE_TOKEN",
    port: number("--port", 0, 0, 65535),
    taskTimeoutMs: number("--task-timeout-ms", 30000, 1, 300000),
    bodyTimeoutMs: number("--body-timeout-ms", 5000, 1, 300000),
    maxConcurrent: number("--max-concurrent", 8, 1, 64),
  };
}

export async function serveProject(path: string, args: string[]) {
  let stop!: () => void;
  const stopped = new Promise<void>((resolve) => {
    stop = resolve;
  });
  let stopping = false;
  const controller = new AbortController();
  const signal = () => {
    stopping = true;
    controller.abort();
    stop();
  };
  process.on("SIGINT", signal);
  process.on("SIGTERM", signal);
  let server: ReturnType<typeof serveRemoteTasks> | undefined;
  try {
    const { tokenEnv, bindingsPath, ...options } = serveOptions(args);
    const token = environmentToken(tokenEnv);
    const workerEnv = { ...process.env };
    delete workerEnv[tokenEnv];
    let endpoints: Map<string, RemoteEndpoint> | undefined;
    if (bindingsPath) {
      const text = await Bun.file(bindingsPath).text();
      endpoints = parseBindings(text);
      for (const endpoint of Object.values(JSON.parse(text).endpoints) as {
        tokenEnv: string;
      }[])
        delete workerEnv[endpoint.tokenEnv];
    }
    const deployment = await loadRemoteDeployment(path, {
      signal: controller.signal,
      workerEnv,
      ...(endpoints ? { endpoints } : {}),
    });
    if (stopping) return;
    server = serveRemoteTasks({ deployment, token, workerEnv, ...options });
    console.log(`Listening on ${server.url}`);
    await stopped;
  } catch (error) {
    console.error(
      `Cannot serve program: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  } finally {
    try {
      await server?.close();
    } catch {
      console.error("Remote server cleanup failed");
      process.exitCode = 1;
    }
    process.off("SIGINT", signal);
    process.off("SIGTERM", signal);
  }
}
