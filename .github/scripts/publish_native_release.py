"""Publish qualified assets; reruns never overwrite an existing release."""
import json
import os
from pathlib import Path
import subprocess
from release_version import classify
from native_release_assets import validate_assets

version = classify(os.environ["RELEASE_TAG"])
assert version["prerelease"] == os.environ["RELEASE_PRERELEASE"]
assets = validate_assets()
llvm_version = json.loads((Path(__file__).resolve().parents[2] / "native/toolchain-proof/toolchain.json").read_text())["llvmVersion"]
notes = f"""Native Kalandra development toolchain for macOS Apple Silicon.

Includes the CPU compiler and private runtime archives, checker, formatter, parser,
language server, and a separately versioned VS Code extension. Standalone CPU/editor
DMGs are Developer ID signed, notarized and stapled, with private LLVM/Clang
{llvm_version} dependencies. The Metal DMG is the mixed CPU/GPU compiler and bundles
its MLIR/SPIR-V translation tools and CPU/Metal runtimes. Apple SDK/linker and the
pinned Apple Metal compiler remain platform prerequisites. Alternate archives
include CPU-only and external-dependency variants. Read each bundle's minimum macOS requirement.

Copy the standalone Metal folder from its DMG and add its `bin` directory to PATH. Read the bundled
`share/doc/kalandra-native-metal/README.md` before use. SHA-256 files accompany assets.
"""
args = ["gh", "release", "create", version["tag"], "--verify-tag", "--draft", "--title", f"Kalandra {version['version']}", "--notes", notes]
if version["prerelease"] == "true":
    args.append("--prerelease")
subprocess.run([*args, *map(str, assets)], check=True)
# A failed upload leaves a draft for inspection. Existing releases are never edited
# unless this invocation successfully created the draft above.
subprocess.run(["gh", "release", "edit", version["tag"], "--draft=false",
                "--latest=" + ("false" if version["prerelease"] == "true" else "true")], check=True)
