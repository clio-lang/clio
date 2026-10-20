"""Installed package scopes across CPU workers and actual Metal dispatch."""
import json
import os
import shutil


def qualify_packages(compiler, checker, cwd, run):
    cwd = cwd.resolve()
    environment = dict(os.environ, GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL="/dev/null",
                       GIT_AUTHOR_NAME="Fixture", GIT_AUTHOR_EMAIL="fixture@example.invalid",
                       GIT_COMMITTER_NAME="Fixture", GIT_COMMITTER_EMAIL="fixture@example.invalid")

    def git(repo, *args):
        return run(["/usr/bin/git", "-C", repo, *args], cwd, env=environment).stdout.strip()

    def commit(repo):
        git(repo, "add", "--all")
        git(repo, "commit", "-m", "fixture")
        return git(repo, "rev-parse", "HEAD")

    def dependency(name, repo, revision):
        return f'{name}={{git={json.dumps(str(repo))},rev="{revision}"}}\n'

    numerical, pipeline = cwd / "numerical library λ", cwd / "pipeline library"
    for repo in (numerical, pipeline):
        repo.mkdir()
        git(repo, "init", "--template=", "--initial-branch=main")
    metadata = "format=1\n[package]\nname='numerical'\nversion='0.1.0'\nentry='public.k'\n"
    (numerical / "kalandra.toml").write_text(metadata)
    # Relative helper imports and a re-export retain their numerical package owner.
    (numerical / "public.k").write_text('export from "./kernel.k" import shift\n')
    kernel = 'export fn shift(values:Tensor[float32,?])->Tensor[float32,?]:\n  values+1\n'
    (numerical / "kernel.k").write_text(kernel)
    old = commit(numerical)
    (numerical / "kernel.k").write_text(kernel.replace("values+1", "values+100"))
    (numerical / "kalandra.toml").write_text(metadata.replace("0.1.0", "0.2.0"))
    new = commit(numerical)
    (pipeline / "public.k").write_text('from "numerical" import shift\nexport fn process(values:Tensor[float32,?])->Tensor[float32,?]:\n  shift(values)\n')
    (pipeline / "kalandra.toml").write_text("format=1\n[package]\nname='pipeline'\nversion='1.0.0'\nentry='public.k'\n[dependencies]\n" + dependency("numerical", numerical, old))
    wrapped = commit(pipeline)
    project = cwd / "package application"
    project.mkdir()
    manifest = project / "kalandra.toml"
    manifest.write_text("format=1\n[project]\nentry='main.k'\n[dependencies]\n" +
                        dependency("numerical", numerical, new) + dependency("pipeline", pipeline, wrapped))
    (project / "main.k").write_text('''from "numerical" import shift
from "pipeline" import process
fn combine(left:Tensor[float32,?],right:Tensor[float32,?])->Tensor[float32,?]:
  left+right
fn main()->Tensor[float32,3] ! TaskError:
  try parallel:
    values:Tensor[float32,3]=tensor([1,2,3])
    prepared=try await spawn process(values)
    gpu=devices.gpu()
    resident=try await transfer(prepared,gpu)
    first=spawn process(resident) on gpu
    second=spawn shift(resident) on gpu
    left=try await first
    right=try await second
    total=try await spawn combine(left,right) on gpu
    try await transfer(total,devices.cpu())
''')
    run([compiler, "install", "--project", manifest], cwd)
    lock_bytes = (project / "kalandra.lock").read_bytes()
    # Reinstall from a committed lock into a fresh project/cache, without resolving refs.
    restored = cwd / "restored package application λ"
    shutil.copytree(project, restored, ignore=shutil.ignore_patterns(".kalandra"))
    run([compiler, "install", "--frozen", "--project", restored / "kalandra.toml"], cwd)
    assert (restored / "kalandra.lock").read_bytes() == lock_bytes
    shutil.rmtree(project)
    shutil.rmtree(numerical)
    shutil.rmtree(pipeline)
    # Project/cache relocation and all following operations work without the origins.
    project = cwd / "relocated package application λ"
    restored.rename(project)
    manifest = project / "kalandra.toml"
    run([compiler, "install", "--frozen", "--offline", "--project", manifest], cwd)
    run([checker, "--placement", "--project", manifest], cwd)
    inputs = {p.relative_to(project): p.read_bytes() for p in project.rglob("*") if p.is_file()}
    applications = []
    # process uses numerical v0.1 on CPU/GPU; the application's shift uses v0.2.
    # CPU: [2,3,4]; GPU private: [3,4,5]; GPU direct: [102,103,104].
    expected = "[42d20000,42d60000,42da0000]"  # [105,107,109], exact float32 bits.
    for name, flags in (("debug", []), ("optimized", ["-O2"]),
                        ("sanitized", ["--sanitize"]), ("thread-sanitized", ["--thread-sanitize"])):
        app = cwd / ("managed application " + name)
        run([compiler, "--project", manifest, "--target", "metal", "-o", app, *flags], cwd)
        assert run([app / "program"], cwd).stdout.strip() == expected
        deps = run(["otool", "-L", app / "program"], cwd).stdout
        assert "libLLVM" not in deps and "libMLIR" not in deps
        applications.append((app, expected))
    assert inputs == {p.relative_to(project): p.read_bytes() for p in project.rglob("*") if p.is_file()}
    app = applications[0][0]
    saved = {p.relative_to(app): p.read_bytes() for p in app.rglob("*") if p.is_file()}
    cached = next(p for p in (project / ".kalandra/snapshots").glob("*/source/kernel.k") if p.read_text() == kernel)
    cached.write_text(kernel + "\n# modified snapshot\n")
    rejected = run([compiler, "--project", manifest, "--target", "metal", "-o", app], cwd, 1)
    assert "digest" in rejected.stderr or "integrity" in rejected.stderr, rejected.stderr
    assert saved == {p.relative_to(app): p.read_bytes() for p in app.rglob("*") if p.is_file()}
    cached.write_text(kernel)
    for target in (project / "kalandra.lock", project / ".kalandra/forbidden"):
        result = run([compiler, "--project", manifest, "--target", "metal", "-o", target], cwd, 1)
        assert "output" in result.stderr, result.stderr
    assert not (project / ".kalandra/forbidden").exists()
    assert inputs == {p.relative_to(project): p.read_bytes() for p in project.rglob("*") if p.is_file()}
    # Once compiled, programs need neither installed package sources nor locks.
    shutil.rmtree(project)
    for app, wanted in applications:
        assert run([app / "program"], cwd).stdout.strip() == wanted
    return applications
