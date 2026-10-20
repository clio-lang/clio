"""Publish qualified assets; reruns never overwrite an existing release."""
import json
import os
from pathlib import Path
import subprocess
from release_version import classify

version = classify(os.environ["RELEASE_TAG"])
assert version["prerelease"] == os.environ["RELEASE_PRERELEASE"]
assets = sorted(Path("release-assets").iterdir())
assert len(assets) == 6 and all(path.is_file() for path in assets)
llvm_version = json.loads((Path(__file__).resolve().parents[2] / "native/toolchain-proof/toolchain.json").read_text())["llvmVersion"]
notes = f"""Native Kalandra development toolchain for macOS Apple Silicon.

Includes the CPU compiler and private runtime archives, checker, formatter, parser,
language server, and a separately versioned VS Code extension. The compiler bundle
requires Homebrew LLVM/MLIR/Clang {llvm_version} (`brew install llvm@{llvm_version.split(".")[0]}`) and the Apple SDK.
This is not a self-contained toolchain. Metal/GPU distribution is not included.

Extract the CPU archive and add its `bin` directory to PATH. Read the bundled
`share/doc/kalandra-native-cpu/README.md` before use. SHA-256 files accompany assets.
"""
args = ["gh", "release", "create", version["tag"], "--verify-tag", "--draft", "--title", f"Kalandra {version['version']}", "--notes", notes]
if version["prerelease"] == "true":
    args.append("--prerelease")
subprocess.run([*args, *map(str, assets)], check=True)
# A failed upload leaves a draft for inspection. Existing releases are never edited
# unless this invocation successfully created the draft above.
subprocess.run(["gh", "release", "edit", version["tag"], "--draft=false",
                "--latest=" + ("false" if version["prerelease"] == "true" else "true")], check=True)
