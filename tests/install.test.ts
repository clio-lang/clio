import { expect, test } from "bun:test";
import { mkdtemp, readdir, rm, symlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gitFixture, verifyInstallCli } from "./helpers/install-cli.js";
const cli = resolve("packages/cli/src/index.ts");
async function fixture(action: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "kalandra-install-"));
  try {
    await action(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const run = (project: string) =>
  Bun.spawnSync([process.execPath, cli, "install", project]);
const config = (deps: Record<string, string>) =>
  '[build]\nsource = "src"\n[dependencies]\n' +
  Object.entries(deps)
    .map(([url, ref]) => `${JSON.stringify(url)} = ${JSON.stringify(ref)}`)
    .join("\n");

test("install resolves transitive dependencies, reuses packages, pins commits, and runs workers", () =>
  fixture((root) => verifyInstallCli(cli, root)));

test("dependency cycles terminate and repeated shared dependencies install once", () =>
  fixture(async (root) => {
    const a = join(root, "a"),
      b = join(root, "b"),
      project = join(root, "project");
    await gitFixture(a, {
      "kalandra.toml": config({ [b]: "v1" }),
      "src/main.kalandra": "export a = 1",
    });
    await gitFixture(b, {
      "kalandra.toml": config({ [a]: "v1" }),
      "src/main.kalandra": "export b = 2",
    });
    await Bun.write(join(project, "kalandra.toml"), config({ [a]: "v1" }));
    const result = run(project);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("2 Kalandra packages (2 new)");
  }));

test("failed transitive fetch leaves existing packages and lock intact, without partial installs", () =>
  fixture(async (root) => {
    const good = join(root, "good"),
      bad = join(root, "bad"),
      project = join(root, "project");
    await gitFixture(good, {
      "kalandra.toml": config({}),
      "src/main.kalandra": "export value = 1",
    });
    await gitFixture(bad, {
      "kalandra.toml": config({ [join(root, "missing")]: "v1" }),
      "src/main.kalandra": "export value = 2",
    });
    await Bun.write(join(project, "kalandra.toml"), config({ [good]: "v1" }));
    expect(run(project).exitCode).toBe(0);
    const lock = await Bun.file(join(project, "kalandra.lock")).text();
    await Bun.write(
      join(project, "kalandra.toml"),
      config({ [good]: "v1", [bad]: "v1" }),
    );
    expect(run(project).exitCode).toBe(1);
    expect(await readdir(join(project, "src/.kalandra/modules"))).toEqual([
      "good@v1",
    ]);
    expect(await Bun.file(join(project, "kalandra.lock")).text()).toBe(lock);
    expect(await readdir(join(project, "src/.kalandra"))).toEqual(["modules"]);
    expect(await readdir(project)).not.toContain(".kalandra-install.lock");
  }));

test("name collisions, unmanaged destinations, unsafe refs and missing refs are explicit failures", () =>
  fixture(async (root) => {
    const one = join(root, "one/math"),
      two = join(root, "two/math"),
      project = join(root, "project");
    for (const repo of [one, two])
      await gitFixture(repo, {
        "kalandra.toml": config({}),
        "src/main.kalandra": "export value = 1",
      });
    await Bun.write(
      join(project, "kalandra.toml"),
      config({ [one]: "v1", [two]: "v1" }),
    );
    expect(run(project).stderr.toString()).toContain("Package name collision");
    expect(await readdir(join(project, "src/.kalandra/modules"))).toEqual([]);
    for (const ref of ["../escape", "-option", "missing"]) {
      await Bun.write(join(project, "kalandra.toml"), config({ [one]: ref }));
      expect(run(project).exitCode).toBe(1);
    }
    await Bun.write(join(project, "kalandra.toml"), config({ [one]: "v1" }));
    await Bun.write(
      join(project, "src/.kalandra/modules/math@v1/keep"),
      "mine",
    );
    expect(run(project).stderr.toString()).toContain("Unmanaged package");
    expect(
      await Bun.file(
        join(project, "src/.kalandra/modules/math@v1/keep"),
      ).text(),
    ).toBe("mine");
  }));

test("invalid package manifests and symlinked install destinations fail without external writes", () =>
  fixture(async (root) => {
    const repo = join(root, "repo"),
      project = join(root, "project"),
      outside = join(root, "outside");
    await gitFixture(repo, {
      "kalandra.toml": '[build]\nsource = "../escape"',
      "src/main.kalandra": "1",
    });
    await Bun.write(join(project, "kalandra.toml"), config({ [repo]: "v1" }));
    expect(run(project).stderr.toString()).toContain("build.source must stay");
    await rm(join(project, "src"), { recursive: true });
    await mkdir(outside);
    await symlink(outside, join(project, "src"));
    expect(run(project).stderr.toString()).toContain("ordinary directory");
    expect(await readdir(outside)).toEqual([]);
  }));

test("installation locks and invalid lockfiles preserve existing state", () =>
  fixture(async (root) => {
    await Bun.write(join(root, "kalandra.toml"), config({}));
    await mkdir(join(root, ".kalandra-install.lock"));
    await Bun.write(join(root, ".kalandra-install.lock/owner"), "active");
    expect(run(root).stderr.toString()).toContain(
      "Another installation may be active",
    );
    expect(
      await Bun.file(join(root, ".kalandra-install.lock/owner")).text(),
    ).toBe("active");
    await rm(join(root, ".kalandra-install.lock"), { recursive: true });
    await Bun.write(
      join(root, "kalandra.lock"),
      '{"version":999,"packages":[]}',
    );
    expect(run(root).stderr.toString()).toContain("Unsupported kalandra.lock");
    expect(await Bun.file(join(root, "kalandra.lock")).text()).toBe(
      '{"version":999,"packages":[]}',
    );
  }));

test("Git dependencies containing symlinks are rejected before publication", () =>
  fixture(async (root) => {
    const repo = join(root, "links"),
      project = join(root, "project");
    const git = await gitFixture(repo, {
      "kalandra.toml": config({}),
      "src/main.kalandra": "1",
    });
    await symlink("main.kalandra", join(repo, "src/link.kalandra"));
    git("add", ".");
    git("commit", "-qm", "link");
    git("tag", "-f", "v1");
    await Bun.write(join(project, "kalandra.toml"), config({ [repo]: "v1" }));
    expect(run(project).stderr.toString()).toContain(
      "Symlinks and submodules are unsupported",
    );
    expect(await readdir(join(project, "src/.kalandra/modules"))).toEqual([]);
  }));
