"""Require successful same-commit platform runs and collect their exact archive assets."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import zipfile


def api(path):
    return json.loads(subprocess.check_output(["gh", "api", path], text=True))


def collect():
    repository = os.environ["GH_REPO"]
    commit = os.environ["GITHUB_SHA"]
    destination = Path("release-assets")
    receipts = []
    for platform in ("linux", "windows"):
        runs = api(f"repos/{repository}/actions/workflows/native-{platform}.yml/runs?head_sha={commit}&status=completed&per_page=100")["workflow_runs"]
        run = next((run for run in runs if run["head_sha"] == commit and run["conclusion"] == "success" and
                    run["event"] == "push" and run["head_branch"] == "native"), None)
        if run is None:
            raise RuntimeError(f"No successful {platform} qualification for the exact release commit")
        artifacts = api(f"repos/{repository}/actions/runs/{run['id']}/artifacts?per_page=100")["artifacts"]
        artifact, = [item for item in artifacts if item["name"] == f"native-{platform}-assets" and not item["expired"]]
        archive_name = f"kalandra-native-cpu-standalone-{platform}-x86_64.tar.gz"
        expected = {archive_name, archive_name + ".sha256"}
        with tempfile.TemporaryFile() as download:
            subprocess.run(["gh", "api", f"repos/{repository}/actions/artifacts/{artifact['id']}/zip"], stdout=download, check=True)
            download.seek(0)
            with zipfile.ZipFile(download) as package:
                members = package.infolist()
                if len(members) != 2 or {member.filename for member in members} != expected:
                    raise RuntimeError("Platform artifact has an unexpected file set")
                for member in members:
                    if member.file_size > 2 * 1024**3 or member.is_dir():
                        raise RuntimeError("Platform artifact exceeds its file contract")
                    with package.open(member) as source, (destination / member.filename).open("xb") as output:
                        import shutil
                        shutil.copyfileobj(source, output)
        receipts.append({"platform": platform, "commit": commit, "run": run["html_url"], "artifactId": artifact["id"]})
    Path("platform-qualification.json").write_text(json.dumps(receipts, indent=2) + "\n")
    print(json.dumps(receipts), flush=True)


if __name__ == "__main__":
    collect()
