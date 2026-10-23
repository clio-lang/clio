"""Verify a downloaded portable archive before executing the CPU contract."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tarfile
import tempfile

from BundleELF import audit


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def qualify(archive):
    assert archive.with_suffix(".gz.sha256").read_text().split()[0] == digest(archive)
    with tempfile.TemporaryDirectory(prefix="kalandra downloaded ", dir=os.environ.get("RUNNER_TEMP")) as folder:
        work = Path(folder)
        with tarfile.open(archive) as package:
            assert all(member.isdir() or member.isfile() for member in package.getmembers())
            assert len({Path(member.name).parts[0] for member in package.getmembers()}) == 1
            package.extractall(work, filter="data")
        prefix, = work.glob("kalandra-native-*")
        files = {str(p.relative_to(prefix)) for p in prefix.rglob("*") if p.is_file()}
        listed = {}
        for line in (prefix / "SHA256SUMS").read_text().splitlines():
            expected, name = line.split("  ", 1)
            assert name not in listed and (prefix / name).resolve().is_relative_to(prefix)
            assert digest(prefix / name) == expected, name
            listed[name] = expected
        assert files == listed.keys() | {"SHA256SUMS"}
        assert json.loads((prefix / "share/kalandra-native-tools/toolchain.json").read_text())["standalone"]
        windows = platform.system() == "Windows"
        if not windows:
            audit(prefix)
        repository = Path(__file__).resolve().parents[2]
        tests = work / "tests"
        tests.mkdir()
        shutil.copy2(Path(__file__).with_name("PortableCPUAcceptance.py"), tests)
        compiler = prefix / "bin" / ("kalandra.exe" if windows else "kalandra")
        command = [sys.executable, str(tests / "PortableCPUAcceptance.py"), "--compiler", str(compiler)]
        if not windows:
            command = ["bwrap", "--unshare-user", "--unshare-net", "--die-with-parent", "--new-session",
                       "--ro-bind", "/", "/", "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp",
                       "--tmpfs", str(repository), "--bind", str(work), str(work), "--chdir", str(work),
                       "--setenv", "HOME", str(work), "--setenv", "PATH", "/usr/bin:/bin",
                       "--unsetenv", "LD_LIBRARY_PATH", "--unsetenv", "LIBRARY_PATH", "--unsetenv", "CPATH",
                       *command]
        subprocess.run(command, check=True, timeout=1800, cwd=work)
        print("Downloaded package inventory, relocation, dependency closure and execution passed", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    qualify(parser.parse_args().archive.resolve())
