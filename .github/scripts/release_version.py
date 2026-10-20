"""Validate version tags and emit GitHub Actions outputs without shell evaluation."""
import os
import re
import sys

CORE = r"(?:0|[1-9][0-9]*)"
IDENT = r"[0-9A-Za-z-]+"
VERSION = re.compile(rf"v({CORE}\.{CORE}\.{CORE})(?:-({IDENT}(?:\.{IDENT})*))?(?:\+({IDENT}(?:\.{IDENT})*))?", re.ASCII)

def classify(tag):
    match = VERSION.fullmatch(tag)
    if not match:
        raise ValueError(f"Not a SemVer version tag: {tag!r}")
    prerelease = match.group(2)
    if prerelease and any(part.isdigit() and len(part) > 1 and part.startswith("0") for part in prerelease.split(".")):
        raise ValueError("Numeric prerelease identifiers must not have leading zeros")
    return {"tag": tag, "version": tag[1:], "prerelease": str(prerelease is not None).lower()}

if __name__ == "__main__":
    try:
        values = classify(os.environ["RELEASE_TAG"])
    except (ValueError, KeyError) as error:
        sys.exit(str(error))
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write("".join(f"{key}={value}\n" for key, value in values.items()))
