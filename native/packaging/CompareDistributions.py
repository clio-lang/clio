"""Require byte-identical standalone archives from independent source builds."""
from pathlib import Path
import argparse
import tarfile

from BundleMachO import digest


def compare(first, second, platform="macos-arm64", kinds=("cpu", "editor-tools", "metal")):
    for kind in kinds:
        relative = Path(f"native-{kind}-standalone") / f"kalandra-native-{kind}-standalone-{platform}.tar.gz"
        left, right = first / relative, second / relative
        if digest(left) != digest(right):
            def inventory(path):
                with tarfile.open(path) as archive:
                    import hashlib
                    return {member.name: hashlib.file_digest(archive.extractfile(member), "sha256").hexdigest()
                            for member in archive if member.isfile()}
            a, b = inventory(left), inventory(right)
            changed = [name for name in sorted(a.keys() | b.keys()) if a.get(name) != b.get(name)]
            raise RuntimeError(f"Independent {kind} source builds differ: {changed}")
        print(f"Independent {kind} source builds: byte-identical SHA-256 {digest(left)}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("first", type=Path)
    parser.add_argument("second", type=Path)
    parser.add_argument("--platform", default="macos-arm64")
    parser.add_argument("--kind", action="append", choices=("cpu", "editor-tools", "metal"))
    args = parser.parse_args()
    compare(args.first, args.second, args.platform, args.kind or ("cpu", "editor-tools", "metal"))
