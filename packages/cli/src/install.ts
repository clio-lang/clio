import { lstat, mkdir, readFile, rename, rm, mkdtemp } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import {
  findProjectManifest,
  projectSource,
} from "../../shared/src/project-root.js";

type Dependency = { url: string; ref: string; name: string };
type Installed = Dependency & { commit: string };
const marker = ".kalandra-package.json";
const safeSegment = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function dependency(url: string, ref: unknown, parent: string): Dependency {
  if (typeof ref !== "string" || !safeSegment.test(ref))
    throw new Error(
      `Unsupported Git ref for ${url}: use a tag, branch without slashes, or commit SHA`,
    );
  let repo: string;
  if (url.startsWith("file://")) {
    url = resolve(fileURLToPath(url));
    repo = basename(url);
  } else if (isAbsolute(url) || url.startsWith("./") || url.startsWith("../")) {
    url = resolve(parent, url);
    repo = basename(url);
  } else if (/^(https|ssh):\/\//.test(url)) {
    const parsed = new URL(url);
    if (parsed.search || parsed.hash || parsed.password)
      throw new Error(
        "Git URLs must not contain queries, fragments, or passwords",
      );
    repo = basename(parsed.pathname);
  } else if (/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:[A-Za-z0-9_./-]+$/.test(url)) {
    repo = basename(url.slice(url.indexOf(":") + 1));
  } else throw new Error(`Unsupported Git URL: ${url}`);
  repo = repo.replace(/\.git$/, "");
  if (!safeSegment.test(repo))
    throw new Error(`Unsupported repository name: ${repo}`);
  return { url, ref, name: `${repo}@${ref}` };
}

function dependencies(text: string, parent: string): Dependency[] {
  const value = (Bun.TOML.parse(text) as { dependencies?: unknown })
    .dependencies;
  if (value === undefined) return [];
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("dependencies must be a TOML table of Git URLs and refs");
  return Object.entries(value).map(([url, ref]) =>
    dependency(url, ref, parent),
  );
}

async function stat(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return null;
    throw error;
  }
}

async function directory(path: string) {
  const info = await stat(path);
  if (info && (!info.isDirectory() || info.isSymbolicLink()))
    throw new Error(`Expected an ordinary directory: ${path}`);
  if (!info) await mkdir(path);
}

async function git(args: string[], cwd: string): Promise<string> {
  const env = { ...process.env };
  // Inherited repository/config overrides must not redirect installation Git commands.
  for (const key of Object.keys(env))
    if (
      /^GIT_(DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG.*|TEMPLATE_DIR)$/.test(
        key,
      )
    )
      delete env[key];
  const child = Bun.spawn(
    [
      "git",
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "init.templateDir=",
      "-c",
      "protocol.ext.allow=never",
      ...args,
    ],
    {
      cwd,
      env: {
        ...env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const timer = setTimeout(() => child.kill(), 120000);
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (code !== 0) throw new Error(`Git ${args[0]} failed: ${stderr.trim()}`);
    return stdout.trim();
  } finally {
    clearTimeout(timer);
  }
}

function record(value: unknown): Installed {
  const item = value as Installed;
  if (
    !item ||
    typeof item.url !== "string" ||
    typeof item.ref !== "string" ||
    typeof item.name !== "string" ||
    typeof item.commit !== "string" ||
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(item.commit) ||
    !safeSegment.test(item.ref) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*@[A-Za-z0-9][A-Za-z0-9._-]*$/.test(item.name)
  )
    throw new Error("Invalid installation record");
  return { url: item.url, ref: item.ref, name: item.name, commit: item.commit };
}

export async function installProject(start = process.cwd()): Promise<void> {
  let stage: string | undefined;
  let guard: string | undefined;
  const published: string[] = [];
  try {
    if (!(await stat(resolve(start)))?.isDirectory())
      throw new Error(
        `Installation directory does not exist: ${resolve(start)}`,
      );
    const found = await findProjectManifest(resolve(start));
    if (!found)
      throw new Error(
        `No enclosing kalandra.toml found from ${resolve(start)}`,
      );
    const project = dirname(found.path);
    const source = projectSource(found.path, found.text);
    const queue = dependencies(found.text, project);
    guard = join(project, ".kalandra-install.lock");
    try {
      await mkdir(guard);
    } catch {
      guard = undefined;
      throw new Error(
        "Another installation may be active (.kalandra-install.lock exists); no changes made",
      );
    }
    const lockPath = join(project, "kalandra.lock");
    const locked = new Map<string, Installed>();
    if (await stat(lockPath)) {
      if (!(await lstat(lockPath)).isFile())
        throw new Error("kalandra.lock must be an ordinary file");
      const lock = JSON.parse(await readFile(lockPath, "utf8"));
      if (lock.version !== 1 || !Array.isArray(lock.packages))
        throw new Error("Unsupported kalandra.lock format");
      for (const entry of lock.packages) {
        const item = record(entry);
        if (locked.has(item.name))
          throw new Error(`Duplicate lock entry: ${item.name}`);
        locked.set(item.name, item);
      }
    }
    let path = project;
    for (const part of relative(project, source).split(sep).filter(Boolean)) {
      path = join(path, part);
      await directory(path);
    }
    const state = join(source, ".kalandra"),
      modules = join(state, "modules");
    await directory(state);
    await directory(modules);
    stage = await mkdtemp(join(state, "install-"));
    const selected = new Map<string, Installed>();
    const pending: { from: string; to: string }[] = [];
    for (let index = 0; index < queue.length; index++) {
      const dep = queue[index]!;
      const previous = selected.get(dep.name);
      if (previous) {
        if (previous.url !== dep.url)
          throw new Error(`Package name collision: ${dep.name}`);
        continue;
      }
      if (selected.size >= 1024)
        throw new Error("Dependency graph exceeds 1024 packages");
      const pin = locked.get(dep.name);
      if (pin && (pin.url !== dep.url || pin.ref !== dep.ref))
        throw new Error(`Lock identity conflict: ${dep.name}`);
      const target = join(modules, dep.name);
      let packagePath = target;
      let item: Installed;
      if (await stat(target)) {
        const info = await lstat(target);
        if (!info.isDirectory() || info.isSymbolicLink())
          throw new Error(`Refusing to replace ${target}`);
        const metadata = join(target, marker);
        if (!(await stat(metadata))?.isFile())
          throw new Error(`Unmanaged package already exists: ${target}`);
        item = record(JSON.parse(await readFile(metadata, "utf8")));
        if (
          item.url !== dep.url ||
          item.ref !== dep.ref ||
          item.name !== dep.name ||
          (pin && pin.commit !== item.commit)
        )
          throw new Error(`Installed package identity conflict: ${dep.name}`);
      } else {
        packagePath = join(stage, dep.name);
        console.log(`Installing ${dep.name}...`);
        await git(
          ["clone", "--no-checkout", "--no-local", "--", dep.url, packagePath],
          stage,
        );
        let commit = pin?.commit;
        if (!commit) {
          const refs = [
            `refs/tags/${dep.ref}`,
            `refs/remotes/origin/${dep.ref}`,
          ];
          if (/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(dep.ref))
            refs.unshift(dep.ref);
          for (const ref of refs) {
            try {
              commit = await git(
                ["rev-parse", "--verify", `${ref}^{commit}`],
                packagePath,
              );
              break;
            } catch {
              /* Try the next exact ref namespace. */
            }
          }
          if (!commit) throw new Error(`Git ref not found: ${dep.name}`);
        }
        if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(commit))
          throw new Error("Invalid Git commit");
        const tree = await git(["ls-tree", "-r", commit], packagePath);
        if (tree.split("\n").some((line) => /^(120000|160000) /.test(line)))
          throw new Error(
            `Symlinks and submodules are unsupported in ${dep.name}`,
          );
        await git(["checkout", "--detach", commit], packagePath);
        await rm(join(packagePath, ".git"), { recursive: true, force: true });
        item = { ...dep, commit };
        if (await stat(join(packagePath, marker)))
          throw new Error(`Reserved package metadata file in ${dep.name}`);
        await Bun.write(join(packagePath, marker), JSON.stringify(item) + "\n");
        pending.push({ from: packagePath, to: target });
      }
      const manifest = join(packagePath, "kalandra.toml");
      if (!(await stat(manifest))?.isFile())
        throw new Error(`Missing ordinary kalandra.toml in ${dep.name}`);
      const text = await readFile(manifest, "utf8");
      const packageSource = projectSource(manifest, text);
      if (!(await stat(packageSource))?.isDirectory())
        throw new Error(`Missing build.source in ${dep.name}`);
      selected.set(dep.name, item);
      // Relative repository locations are relative to the original local repository, never staging.
      const children = dependencies(
        text,
        isAbsolute(dep.url) ? dep.url : packagePath,
      );
      if (
        !isAbsolute(dep.url) &&
        children.some((child) => isAbsolute(child.url))
      )
        throw new Error(
          `Remote package ${dep.name} cannot declare local Git dependencies`,
        );
      queue.push(...children);
    }
    if ((await readFile(found.path, "utf8")) !== found.text)
      throw new Error("Project manifest changed during installation; retry");
    const lockText =
      JSON.stringify(
        {
          version: 1,
          packages: [...selected.values()].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        },
        null,
        2,
      ) + "\n";
    const stagedLock = join(guard, "kalandra.lock");
    await Bun.write(stagedLock, lockText);
    for (const item of pending) {
      if (await stat(item.to))
        throw new Error(`Package appeared during installation: ${item.to}`);
      await rename(item.from, item.to);
      published.push(item.to);
    }
    await rename(stagedLock, lockPath);
    published.length = 0;
    console.log(
      `Installed ${selected.size} Kalandra packages (${pending.length} new).`,
    );
  } catch (error) {
    for (const path of published.reverse())
      await rm(path, { recursive: true, force: true });
    console.error(
      `Cannot install dependencies: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  } finally {
    if (stage) await rm(stage, { recursive: true, force: true });
    if (guard) await rm(guard, { recursive: true, force: true });
  }
}
