"""Import CI credentials into an ephemeral Keychain and notarize hosted builds.

Secrets are supplied only by GitHub Actions environment variables. Never echo
subprocess arguments or output from credential-management commands on failure.
"""
import base64
import argparse
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
    try:
        result = subprocess.run(list(map(str, args)), capture_output=True, timeout=180)
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"Credential operation timed out ({Path(args[0]).name}); arguments suppressed") from None
    if result.returncode:
        raise RuntimeError(f"Credential setup failed ({Path(args[0]).name}); command output suppressed")


def main(check_only=False):
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
        print("Encrypted signing identity imported successfully", flush=True)
        private_command("/usr/bin/security", "set-key-partition-list", "-S",
                        "apple-tool:,apple:,codesign:", "-s", "-k", password, keychain)
        private_command("/usr/bin/xcrun", "notarytool", "store-credentials", "kalandra-ci",
                        "--keychain", keychain, "--apple-id", os.environ["KALANDRA_APPLE_ID"],
                        "--team-id", os.environ["KALANDRA_APPLE_TEAM_ID"],
                        "--password", os.environ["KALANDRA_APPLE_APP_PASSWORD"], "--validate")
        print("Apple notarization authentication validated", flush=True)
        if check_only:
            # Prove that the imported private key is usable without UI prompts,
            # the certificate matches this publisher, and trusted timestamps work.
            source, executable = root / "check.c", root / "check"
            source.write_text("int main(void) { return 0; }\n")
            private_command("/usr/bin/xcrun", "clang", source, "-o", executable)
            private_command("/usr/bin/codesign", "--force", "--sign",
                            os.environ["KALANDRA_SIGNING_IDENTITY"], "--keychain", keychain,
                            "--timestamp", "--options", "runtime", executable)
            private_command("/usr/bin/codesign", "--verify", "--strict", executable)
            details = subprocess.run(["/usr/bin/codesign", "--display", "--verbose=4", str(executable)],
                                     capture_output=True, text=True, timeout=30)
            if (details.returncode or "Authority=Developer ID Application:" not in details.stderr or
                    f"TeamIdentifier={os.environ['KALANDRA_APPLE_TEAM_ID']}" not in details.stderr):
                raise RuntimeError("Signing identity does not match the configured Developer ID team")
            private_command(str(executable))
            print("Credential check passed: Developer ID signing, trusted timestamp, execution, "
                  "and Apple notarization authentication", flush=True)
            return
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-only", action="store_true")
    main(parser.parse_args().check_only)
