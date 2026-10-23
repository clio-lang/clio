"""Verify official LLVM release archives before portable CI qualification."""
import json
import os
from pathlib import Path
import platform
import subprocess
import tarfile
import urllib.request
from compression import zstd

from provision_native_llvm import save_verified, sha256


def main():
    if os.environ.get("GITHUB_ACTIONS") != "true":
        raise RuntimeError("This provisioner is restricted to disposable GitHub runners")
    lock = json.loads(Path("native/toolchain-proof/toolchain.json").read_text())
    key = {"Linux": "linux-x64", "Windows": "windows-x64"}.get(platform.system())
    if key is None or platform.machine().lower() not in ("amd64", "x86_64"):
        raise RuntimeError("Unqualified CI platform")
    asset = lock["officialArchives"][key]
    work = Path(os.environ["RUNNER_TEMP"]) / "kalandra-llvm"
    work.mkdir()
    archive = work / asset["name"]
    url = f"https://github.com/llvm/llvm-project/releases/download/llvmorg-{lock['llvmVersion']}/{asset['name']}"
    with urllib.request.urlopen(url, timeout=120) as response:
        save_verified(response, archive, asset["sha256"])
    print(f"Verified official archive: {archive.name} SHA-256 {sha256(archive)}", flush=True)
    print(f"Archive magic: {archive.open('rb').read(8).hex()}", flush=True)
    # LLVM uses long-window zstd compression; Python's default decoder window
    # cap may reject an otherwise valid, hash-verified release archive.
    with zstd.ZstdFile(archive, options={zstd.DecompressionParameter.window_log_max: 31}) as decoded:
        with tarfile.open(fileobj=decoded, mode="r|") as source:
            source.extractall(work / "installation", filter="data")
    archive.unlink()
    configs = list((work / "installation").rglob("MLIRConfig.cmake"))
    if len(configs) != 1:
        raise RuntimeError(f"Official LLVM archive contains {len(configs)} MLIR development configurations")
    root = configs[0].parents[3]
    compiler = root / "bin" / ("clang.exe" if key == "windows-x64" else "clang")
    subprocess.run([str(compiler), "--version"], check=True)
    with open(os.environ["GITHUB_ENV"], "a") as environment:
        environment.write(f"KALANDRA_LLVM_ROOT={root.as_posix()}\n")
    print(f"LLVM/MLIR development root: {root}", flush=True)


if __name__ == "__main__":
    main()
