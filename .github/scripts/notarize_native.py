"""Import CI credentials into an ephemeral Keychain and notarize hosted builds.

Secrets are supplied only by GitHub Actions environment variables. Never echo
subprocess arguments or output from credential-management commands on failure.
"""
import base64
import os
from pathlib import Path
import platform
import secrets
import shutil
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "native/packaging"))
from SignDistribution import sign


def require_ci():
    if os.environ.get("GITHUB_ACTIONS") != "true" or platform.system() != "Darwin":
        raise RuntimeError("Signing credentials may only be imported on a GitHub macOS runner")


def private_command(*args):
    result = subprocess.run(list(map(str, args)), capture_output=True, timeout=180)
    if result.returncode:
        raise RuntimeError(f"Credential setup failed ({Path(args[0]).name}); command output suppressed")


def main():
    require_ci()
    names = ("KALANDRA_SIGNING_P12_BASE64", "KALANDRA_SIGNING_P12_PASSWORD",
             "KALANDRA_APPLE_ID", "KALANDRA_APPLE_APP_PASSWORD",
             "KALANDRA_APPLE_TEAM_ID", "KALANDRA_SIGNING_IDENTITY")
    missing = [name for name in names if not os.environ.get(name)]
    if missing:
        raise RuntimeError("Configure GitHub signing secrets/variables first: " + ", ".join(missing))
    root = Path(os.environ["RUNNER_TEMP"]) / "kalandra-signing"
    root.mkdir(mode=0o700)  # Fail if a previous session has not been cleaned up.
    keychain = root / "signing.keychain-db"
    p12 = root / "identity.p12"
    password = secrets.token_urlsafe(48)
    print("::add-mask::" + password, flush=True)
    try:
        p12.write_bytes(base64.b64decode(os.environ["KALANDRA_SIGNING_P12_BASE64"], validate=True))
        p12.chmod(0o600)
        private_command("/usr/bin/security", "create-keychain", "-p", password, keychain)
        private_command("/usr/bin/security", "set-keychain-settings", "-lut", "7200", keychain)
        private_command("/usr/bin/security", "unlock-keychain", "-p", password, keychain)
        private_command("/usr/bin/security", "import", p12, "-k", keychain,
                        "-P", os.environ["KALANDRA_SIGNING_P12_PASSWORD"], "-T", "/usr/bin/codesign")
        p12.unlink()
        private_command("/usr/bin/security", "set-key-partition-list", "-S",
                        "apple-tool:,apple:,codesign:", "-s", "-k", password, keychain)
        private_command("/usr/bin/xcrun", "notarytool", "store-credentials", "kalandra-ci",
                        "--keychain", keychain, "--apple-id", os.environ["KALANDRA_APPLE_ID"],
                        "--team-id", os.environ["KALANDRA_APPLE_TEAM_ID"],
                        "--password", os.environ["KALANDRA_APPLE_APP_PASSWORD"])
        for kind in ("editor-tools", "cpu"):
            name = f"kalandra-native-{kind}-standalone-macos-arm64.tar.gz"
            sign(Path("release-assets") / name, Path("signed-assets") / kind,
                 os.environ["KALANDRA_SIGNING_IDENTITY"], os.environ["KALANDRA_APPLE_TEAM_ID"],
                 "kalandra-ci", keychain)
    finally:
        subprocess.run(["/usr/bin/security", "delete-keychain", str(keychain)],
                       capture_output=True, timeout=30)
        shutil.rmtree(root, ignore_errors=True)


if __name__ == "__main__":
    main()
