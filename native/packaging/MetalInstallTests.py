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
from MetalPackageTests import qualify_packages

cmake, build, config, packager, fixtures = sys.argv[1:]
build, fixtures = Path(build), Path(fixtures)

def run(args, cwd, expected=0, env=None):
    result = subprocess.run(list(map(str, args)), cwd=cwd, env=env, capture_output=True, text=True, timeout=90)
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
    assert not (prefix / "bin/kalandrac").exists()
    compiler = cwd / "compiler symlink"
    compiler.symlink_to(prefix / "bin/kalandra")
    starter = cwd / "installed starter"
    run([compiler, "new", starter], cwd)
    run([compiler, "--project", starter / "kalandra.toml", "-o", cwd / "starter program"], cwd)
    assert run([cwd / "starter program"], cwd).stdout.strip() == "[2, 4, 6]"
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
        applications.append((app, "[40a00000,41400000,41a80000]"))
    # Composed source entries also retain their supplemental reduction shader when moved.
    composed_source = cwd / "pre-reduction.k"
    composed_source.write_bytes((fixtures / "pre-reduction.k").read_bytes())
    composed_app = cwd / "composed application"
    run([compiler, composed_source, "--target", "metal", "-o", composed_app, "-O2"], cwd)
    assert (composed_app / "kernel0-reduce.metallib").is_file()
    assert run([composed_app / "program"], cwd).stdout.strip() == "42960000"
    applications.append((composed_app, "42960000"))
    post_source = cwd / "post-reduction.k"
    post_source.write_bytes((fixtures / "post-reduction.k").read_bytes())
    post_app = cwd / "post reduction application"
    run([compiler, post_source, "--target", "metal", "-o", post_app, "-O2"], cwd)
    assert (post_app / "kernel0-post.metallib").is_file()
    assert run([post_app / "program"], cwd).stdout.strip() == "c1d00000"
    applications.append((post_app, "c1d00000"))
    matrix_source = cwd / "post-matmul.k"
    matrix_source.write_bytes((fixtures / "post-matmul.k").read_bytes())
    matrix_app = cwd / "post matrix application"
    run([compiler, matrix_source, "--target", "metal", "-o", matrix_app, "-O2"], cwd)
    assert (matrix_app / "kernel0-post.metallib").is_file()
    matrix_result = "[42380000,42700000,42d00000,43080000]"
    assert run([matrix_app / "program"], cwd).stdout.strip() == matrix_result
    applications.append((matrix_app, matrix_result))
    pre_source = cwd / "pre-matmul.k"
    pre_source.write_bytes((fixtures / "pre-matmul.k").read_bytes())
    pre_app = cwd / "matrix operand application"
    run([compiler, pre_source, "--target", "metal", "-o", pre_app, "-O2"], cwd)
    for stage in ("left", "right", "post"):
        assert (pre_app / f"kernel0-{stage}.metallib").is_file()
    pre_result = "[42680000,42a80000,42c40000,430e0000]"
    assert run([pre_app / "program"], cwd).stdout.strip() == pre_result
    applications.append((pre_app, pre_result))
    sum_source = cwd / "matmul-reduction.k"
    sum_source.write_bytes((fixtures / "matmul-reduction.k").read_bytes())
    sum_app = cwd / "matrix reduction application"
    run([compiler, sum_source, "--target", "metal", "-o", sum_app, "-O2"], cwd)
    for stage in ("left", "right", "reduce"):
        assert (sum_app / f"kernel0-{stage}.metallib").is_file()
    assert run([sum_app / "program"], cwd).stdout.strip() == "43350000"
    applications.append((sum_app, "43350000"))
    adjusted_source = cwd / "matmul-adjust-reduction.k"
    adjusted_source.write_bytes((fixtures / "matmul-adjust-reduction.k").read_bytes())
    adjusted_app = cwd / "adjusted matrix reduction application"
    run([compiler, adjusted_source, "--target", "metal", "-o", adjusted_app, "-O2"], cwd)
    for stage in ("left", "right", "post", "reduce"):
        assert (adjusted_app / f"kernel0-{stage}.metallib").is_file()
    assert run([adjusted_app / "program"], cwd).stdout.strip() == "43bf0000"
    applications.append((adjusted_app, "43bf0000"))
    scalar_source = cwd / "matmul-scalar-reduction.k"
    scalar_source.write_bytes((fixtures / "matmul-scalar-reduction.k").read_bytes())
    scalar_app = cwd / "matrix scalar reduction application"
    run([compiler, scalar_source, "--target", "metal", "-o", scalar_app, "-O2"], cwd)
    for stage in ("left", "right", "post", "reduce", "scalar"):
        assert (scalar_app / f"kernel0-{stage}.metallib").is_file()
    assert run([scalar_app / "program"], cwd).stdout.strip() == "c3400000"
    applications.append((scalar_app, "c3400000"))
    graph_source = cwd / "matrix-graph.k"
    graph_source.write_bytes((fixtures / "matrix-graph.k").read_bytes())
    graph_app = cwd / "matrix graph application"
    run([compiler, graph_source, "--target", "metal", "-o", graph_app, "-O2"], cwd)
    graph_result = "[42d40000,431c0000,43710000,43b10000]"
    assert run([graph_app / "program"], cwd).stdout.strip() == graph_result
    applications.append((graph_app, graph_result))
    graph_sum_source = cwd / "matrix-graph-reduction.k"
    graph_sum_source.write_bytes((fixtures / "matrix-graph-reduction.k").read_bytes())
    graph_sum_app = cwd / "matrix graph reduction application"
    run([compiler, graph_sum_source, "--target", "metal", "-o", graph_sum_app, "-O2"], cwd)
    for stage in ("reduce", "scalar"):
        assert (graph_sum_app / f"kernel0-{stage}.metallib").is_file()
    assert run([graph_sum_app / "program"], cwd).stdout.strip() == "c3d6c000"
    applications.append((graph_sum_app, "c3d6c000"))
    mixed_source = cwd / "matrix-graph-arithmetic.k"
    mixed_source.write_bytes((fixtures / "matrix-graph-arithmetic.k").read_bytes())
    mixed_app = cwd / "mixed matrix graph application"
    run([compiler, mixed_source, "--target", "metal", "-o", mixed_app, "-O2"], cwd)
    for stage in (1, 2, 3):
        assert (mixed_app / f"kernel0-map{stage}.metallib").is_file()
    mixed_result = "[c2620000,c2a60000,c3000000,c33c0000]"
    assert run([mixed_app / "program"], cwd).stdout.strip() == mixed_result
    applications.append((mixed_app, mixed_result))
    multi_source = cwd / "multiple-reductions.k"
    multi_source.write_bytes((fixtures / "multiple-reductions.k").read_bytes())
    multi_app = cwd / "multiple reduction application"
    run([compiler, multi_source, "--target", "metal", "-o", multi_app, "-O2"], cwd)
    for stage in ("reduce", "join"):
        assert (multi_app / f"kernel0-{stage}.metallib").is_file()
    assert run([multi_app / "program"], cwd).stdout.strip() == "c3ad8000"
    applications.append((multi_app, "c3ad8000"))
    feedback_source = cwd / "reduction-feedback.k"
    feedback_source.write_bytes((fixtures / "reduction-feedback.k").read_bytes())
    feedback_app = cwd / "reduction feedback application"
    run([compiler, feedback_source, "--target", "metal", "-o", feedback_app, "-O2"], cwd)
    for stage in ("reduce", "join", "map0", "map1"):
        assert (feedback_app / f"kernel0-{stage}.metallib").is_file()
    assert run([feedback_app / "program"], cwd).stdout.strip() == "402aaaab"
    applications.append((feedback_app, "402aaaab"))
    tensor_source = cwd / "tensor-feedback.k"
    tensor_source.write_bytes((fixtures / "tensor-feedback.k").read_bytes())
    tensor_app = cwd / "tensor feedback application"
    run([compiler, tensor_source, "--target", "metal", "-o", tensor_app, "-O2"], cwd)
    assert (tensor_app / "kernel0-map0.metallib").is_file()
    assert not (tensor_app / "kernel0-join.metallib").exists()
    tensor_result = "[3f000000,3f800000,3fc00000]"
    assert run([tensor_app / "program"], cwd).stdout.strip() == tensor_result
    applications.append((tensor_app, tensor_result))
    # Local module/project imports go through the same installed Metal compiler.
    (cwd / "helper.k").write_text("export " + source.read_text().split("\n\nfn main", 1)[0] + "\n")
    source.write_text('from "math" import combine\n\nfn main' + source.read_text().split("\n\nfn main", 1)[1])
    manifest = cwd / "kalandra.toml"
    manifest.write_text('format=1\n[project]\nentry="placed.k"\n[packages]\nmath="helper.k"\n')
    app = cwd / "project application"
    run([compiler, "--project", manifest, "--target", "metal", "-o", app], cwd)
    assert run([app / "program"], cwd).stdout.strip() == "[40a00000,41400000,41a80000]"
    applications.append((app, "[40a00000,41400000,41a80000]"))
    applications.extend(qualify_packages(compiler, prefix / "bin/kalandra-check", cwd, run))
    saved = (app / "program").read_bytes()
    helper = resources / "kalandra-metal-strict"
    helper.unlink()
    result = run([compiler, "--project", manifest, "--target", "metal", "-o", app], cwd, 1)
    assert "installed Metal resource is missing" in result.stderr
    assert (app / "program").read_bytes() == saved
    # Generated applications retain only their own shaders and system dependencies.
    shutil.rmtree(prefix)
    for i, (app, expected) in enumerate(applications):
        moved = cwd / f"moved application {i}"
        app.rename(moved)
        assert run([moved / "program"], cwd).stdout.strip() == expected
print("Metal bundle: checksums, relocation/symlink, CPU compile, four GPU modes, scoped managed packages with CPU workers, frozen/offline relocation, source integrity, project import, missing helper and independent moved applications passed")
