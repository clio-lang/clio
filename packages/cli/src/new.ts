import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

/** Embedded starter: no network, subprocess, package installation or Git setup. */
export const starterFiles: Readonly<Record<string, string>> = {
  "kalandra.toml": '[build]\nsource = "src"\n',
  ".bun-version": "1.3.12\n",
  ".gitignore":
    "/build/\n/node_modules/\n/src/.kalandra/modules/\n.env\n.env.*\n!.env.example\n.DS_Store\n",
  "src/math.kalandra":
    '@describe "Double a number"\n@params Number\n@returns Number\nexport fn double value: value * 2\n',
  "src/main.kalandra":
    'from "./math" import double\n\nexport fn main:\n  [1 2 3] -> * [await] |double|\n',
  "README.md": `# Your Kalandra project

This dependency-free starter uses two modules and a typed parallel call. Running
it returns [2, 4, 6]. Number values cross worker boundaries as float64.

## Run and build

Use Bun 1.3.12 and a Kalandra CLI on your PATH:

\`\`\`sh
kalandra run src/main.kalandra --strict
kalandra build src/main.kalandra -o build --strict
kalandra build src/main.kalandra -o build --strict --watch
\`\`\`

The current development workspace is not yet a published npm installation.
Without an installed CLI, replace \`kalandra\` in these commands with
\`bun /absolute/path/to/kalandra.dev/packages/cli/src/index.ts\`.
A built checkout also supports \`bun /absolute/path/to/dist/cli/index.js\`.
Run commands from this project directory. No dependency installation is needed.

## Inspect and edit

\`\`\`sh
kalandra docs src/math.kalandra double
kalandra highlight src/main.kalandra
kalandra fmt src/main.kalandra --check
\`\`\`

Edit src/main.kalandra to change the inputs and src/math.kalandra to change the
worker function. Keep concrete annotations on values crossing parallel
boundaries. The manifest sets src as the source root; build output is explicit.
Build copies ordinary assets under src, excluding hidden files, dependencies,
source files and the selected output directory. Watch rebuilds without running
programs; Ctrl-C stops it.

This command did not initialize Git or install packages. If you later add Git
Kalandra dependencies to kalandra.toml, run kalandra install and commit the
resulting kalandra.lock. JavaScript package management uses Bun separately.

Language documentation: https://kalandra.dev/docs
`,
};

export async function createProject(destination: string) {
  const root = resolve(destination);
  let created = false;
  try {
    // Exclusive directory creation also refuses existing empty directories and links.
    // The parent must exist. Do not recursively remove a project on later failure.
    await mkdir(root);
    created = true;
    await mkdir(join(root, "src"));
    for (const [name, text] of Object.entries(starterFiles))
      await writeFile(join(root, name), text, { encoding: "utf8", flag: "wx" });
    console.log(
      `Created Kalandra project: ${root}\nSee README.md for run/build commands and development CLI usage.\nExpected main result: [2, 4, 6]`,
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    const reason =
      !created && code === "EEXIST"
        ? "Destination already exists; choose a new directory"
        : !created && code === "ENOENT"
          ? "Parent directory does not exist"
          : error instanceof Error
            ? error.message
            : String(error);
    console.error(
      `Cannot create project ${root}: ${reason}${created ? ". A partial project was retained; inspect it before retrying" : ""}`,
    );
    process.exitCode = 1;
  }
}
