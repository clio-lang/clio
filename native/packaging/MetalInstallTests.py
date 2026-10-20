"""Relocated Metal compiler builds GPU applications outside its checkout."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile

cmake, build, config, packager, fixtures = sys.argv[1:]
build, fixtures = Path(build), Path(fixtures)

def run(args, cwd, expected=0):
    result = subprocess.run(list(map(str, args)), cwd=cwd, capture_output=True, text=True, timeout=90)
    assert result.returncode == expected, (args, result.returncode, result.stdout, result.stderr)
    return result

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

with tempfile.TemporaryDirectory(prefix="kalandra metal install ") as temporary:
    cwd = Path(temporary)
    output = cwd / "artifacts"
    run([cmake, f"-DBUILD_DIR={build}", f"-DCONFIG={config}", f"-DOUTPUT_DIR={output}",
         "-DPACKAGE_CPU=ON", "-DPACKAGE_METAL=ON", "-P", packager], cwd)
    archive = output / "kalandra-native-metal-macos-arm64.tar.gz"
    assert archive.with_suffix(".gz.sha256").read_text().split()[0] == digest(archive)
    original_archive = digest(archive)
    sidecar = archive.with_suffix(".gz.sha256").read_bytes()
    run([cmake, f"-DBUILD_DIR={build}", "-DCONFIG=NotConfigured", f"-DOUTPUT_DIR={output}",
         "-DPACKAGE_CPU=ON", "-DPACKAGE_METAL=ON", "-P", packager], cwd, 1)
    assert digest(archive) == original_archive and archive.with_suffix(".gz.sha256").read_bytes() == sidecar
    with tarfile.open(archive) as bundle:
        assert all(member.isdir() or member.isfile() for member in bundle.getmembers())
        bundle.extractall(cwd / "relocated prefix", filter="data")
    shutil.rmtree(output / "package-stage")
    prefix = cwd / "relocated prefix/kalandra-native-metal"
    names = set()
    for line in (prefix / "SHA256SUMS").read_text().splitlines():
        expected, name = line.split("  ", 1)
        assert name not in names and (prefix / name).resolve().is_relative_to(prefix.resolve())
        names.add(name)
        assert digest(prefix / name) == expected
    assert names == {str(p.relative_to(prefix)) for p in prefix.rglob("*") if p.is_file()} - {"SHA256SUMS"}
    resources = prefix / "lib/kalandra/native"
    assert len(list(resources.glob("*.a"))) == 35
    metadata = json.loads((prefix / "share/kalandra-native-metal/toolchain.json").read_text())
    assert metadata["format"] == 1 and metadata["configuration"] == config
    assert metadata["llvmVersion"] == json.loads((Path(__file__).parents[1] / "toolchain-proof/toolchain.json").read_text())["llvmVersion"] and metadata["externalDependencies"] is True
    for name in ("kalandra-metal-strict", "kalandra-metal-extract"):
        assert os.access(resources / name, os.X_OK)
        assert run(["lipo", "-archs", resources / name], cwd).stdout.strip() == "arm64"
    compiler = cwd / "compiler symlink"
    compiler.symlink_to(prefix / "bin/kalandrac")
    (cwd / "cpu.k").write_text("fn main() -> int:\n  42\n")
    run([compiler, cwd / "cpu.k", "-o", cwd / "cpu"], cwd)
    assert run([cwd / "cpu"], cwd).stdout.strip() == "42"
    source = cwd / "placed.k"
    source.write_bytes((fixtures / "placed.k").read_bytes())
    applications = []
    for name, flags in (("debug", []), ("optimized", ["-O2"]),
                        ("sanitized", ["--sanitize"]), ("thread-sanitized", ["--thread-sanitize"])):
        app = cwd / ("application " + name)
        run([compiler, source, "--target", "metal", "-o", app, *flags], cwd)
        assert run([app / "program"], cwd).stdout.strip() == "[40a00000,41400000,41a80000]"
        deps = run(["otool", "-L", app / "program"], cwd).stdout
        assert "libLLVM" not in deps and "libMLIR" not in deps
        applications.append(app)
    # Local module/project imports go through the same installed Metal compiler.
    (cwd / "helper.k").write_text("export " + source.read_text().split("\n\nfn main", 1)[0] + "\n")
    source.write_text('from "math" import combine\n\nfn main' + source.read_text().split("\n\nfn main", 1)[1])
    manifest = cwd / "kalandra.toml"
    manifest.write_text('format=1\n[project]\nentry="placed.k"\n[packages]\nmath="helper.k"\n')
    app = cwd / "project application"
    run([compiler, "--project", manifest, "--target", "metal", "-o", app], cwd)
    assert run([app / "program"], cwd).stdout.strip() == "[40a00000,41400000,41a80000]"
    applications.append(app)
    saved = (app / "program").read_bytes()
    helper = resources / "kalandra-metal-strict"
    helper.unlink()
    result = run([compiler, "--project", manifest, "--target", "metal", "-o", app], cwd, 1)
    assert "installed Metal resource is missing" in result.stderr
    assert (app / "program").read_bytes() == saved
    # Generated applications retain only their own shaders and system dependencies.
    shutil.rmtree(prefix)
    for i, app in enumerate(applications):
        moved = cwd / f"moved application {i}"
        app.rename(moved)
        assert run([moved / "program"], cwd).stdout.strip() == "[40a00000,41400000,41a80000]"
print("Metal bundle: checksums, relocation/symlink, CPU compile, four GPU modes, project import, missing helper and independent moved applications passed")
