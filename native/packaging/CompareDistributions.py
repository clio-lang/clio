"""Require byte-identical standalone archives from independent source builds."""
from pathlib import Path
import sys
import tarfile

from BundleMachO import digest


def compare(first, second):
    for kind in ("cpu", "editor-tools", "metal"):
        relative = Path(f"native-{kind}-standalone") / f"kalandra-native-{kind}-standalone-macos-arm64.tar.gz"
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
    compare(*map(Path, sys.argv[1:]))
