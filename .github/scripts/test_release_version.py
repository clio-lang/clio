import unittest
from release_version import classify

class VersionTests(unittest.TestCase):
    def test_stable(self):
        for tag in ("v0.1.0", "v1.2.3", "v12.34.56+build.01"):
            with self.subTest(tag=tag):
                self.assertEqual(classify(tag)["prerelease"], "false")
                self.assertEqual(classify(tag)["version"], tag[1:])

    def test_prerelease(self):
        for suffix in ("alpha", "alpha.1", "beta.2", "rc.1", "preview.5", "dev", "0", "rc.1+build.9"):
            with self.subTest(suffix=suffix):
                self.assertEqual(classify("v1.2.3-" + suffix)["prerelease"], "true")

    def test_reject(self):
        for tag in ("1.2.3", "v1.2", "v01.2.3", "v1.02.3", "v1.2.03", "v1.2.3-01", "v1.2.3-rc.01",
                    "v1.2.3-", "v1.2.3+", "v1.2.3-rc..1", "v1.2.3\n", "v1.2.3;echo hi", "v1.2.3-α"):
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                classify(tag)


class PublishTests(unittest.TestCase):
    def exercise(self, tag, fail=False):
        import os
        from pathlib import Path
        import runpy
        import subprocess
        import tempfile
        from unittest.mock import patch
        script = Path(__file__).with_name("publish_native_release.py").resolve()
        with tempfile.TemporaryDirectory() as temporary:
            previous = Path.cwd()
            os.chdir(temporary)
            try:
                from test_native_release_assets import write_fixture
                write_fixture(Path.cwd())
                with patch.dict(os.environ, {"RELEASE_TAG": tag, "RELEASE_PRERELEASE": classify(tag)["prerelease"]}), patch("subprocess.run") as run:
                    if fail:
                        run.side_effect = subprocess.CalledProcessError(1, "gh")
                        with self.assertRaises(subprocess.CalledProcessError):
                            runpy.run_path(str(script))
                        self.assertEqual(run.call_count, 1)
                    else:
                        runpy.run_path(str(script))
                        create, edit = [call.args[0] for call in run.call_args_list]
                        self.assertIn("--draft", create)
                        self.assertIn("--verify-tag", create)
                        import json
                        llvm_version = json.loads((script.parents[2] / "native/toolchain-proof/toolchain.json").read_text())["llvmVersion"]
                        self.assertIn(llvm_version, create[create.index("--notes") + 1])
                        self.assertEqual("--prerelease" in create, classify(tag)["prerelease"] == "true")
                        self.assertIn("--latest=" + str(classify(tag)["prerelease"] == "false").lower(), edit)
            finally:
                os.chdir(previous)

    def test_stable_publication(self):
        self.exercise("v1.2.3")

    def test_prerelease_publication(self):
        self.exercise("v1.2.3-rc.1")

    def test_failed_creation_never_edits_release(self):
        self.exercise("v1.2.3", fail=True)

if __name__ == "__main__":
    unittest.main()
