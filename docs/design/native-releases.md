# Native release automation

The `Native release` GitHub Actions workflow builds macOS Apple Silicon CPU
packages and a separately versioned VS Code extension from a version tag.
It does not publish npm packages, the website or the extension Marketplace.

- `v1.0.0` creates a normal GitHub release and marks it latest.
- `v1.0.0-alpha.1`, `v1.0.0-beta.1`, `v1.0.0-rc.1`, and other valid SemVer
  prerelease identifiers create GitHub **prereleases**, never latest stable.
- Build metadata alone, such as `v1.0.0+build.1`, is stable. Invalid SemVer tags
  fail validation, including numeric identifiers with leading zeros.

After a release commit is reviewed and ready, tag that exact commit and push the
version tag. The workflow checks out the tagged commit, checks the version parser,
installs the pinned native dependencies, builds Release packages, runs installation
and relocation acceptance, and builds/tests the editor package. It uploads the CPU
bundle, the smaller editor-tools-only bundle, the VSIX and their checksum sidecars.
The VSIX retains its independent version from `native/editor/vscode/package.json`.

Only the publishing job receives repository write permission. It creates a draft
with assets, then publishes after successful upload. A failed upload leaves a draft;
inspect it before retrying. Reruns do not overwrite an existing release or its
assets. Delete a failed draft explicitly if a retry is appropriate. Cancellation
is disabled for concurrent runs of the same ref.

Manual workflow dispatch runs the same build/qualification and uploads workflow
artifacts, but does not publish a release. GitHub requires the workflow to exist on the
default branch before manual dispatch is available; then select the native branch
for a rehearsal before the first native release tag. It creates no tag. Existing historical tags are not replayed.

This first release workflow distributes the [CPU package](native-cpu-install.md)
with external Homebrew LLVM/MLIR/Clang 22.1.8 and Apple SDK dependencies. The compiler
is not self-contained or signed/notarized; Metal packaging and additional platforms
remain tracked work. Qualification here establishes installation and packaging
behavior, not completion of all language/GPU release gates. No tag or release is
created simply by committing this workflow.
