import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  chmod,
  realpath,
} from "node:fs/promises";
import { join, resolve } from "node:path";

// Publish an assembled, self-contained toolchain. Workspace source manifests stay private.
const root = resolve(import.meta.dir, "..");
const destination = join(root, "dist/release/cli");
const { version } = await Bun.file(join(root, "package.json")).json();
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const name of [
  "cli",
  "compiler",
  "runtime",
  "protocol",
  "language-server",
]) {
  await cp(join(root, "dist", name), join(destination, "dist", name), {
    recursive: true,
  });
}
for (const name of ["LICENSE", "NOTICE"])
  await cp(join(root, name), join(destination, name));
await Bun.write(
  join(destination, "package.json"),
  JSON.stringify(
    {
      name: "@kalandra/cli",
      version,
      description:
        "Kalandra language and framework for parallel and distributed applications",
      license: "Apache-2.0",
      type: "module",
      engines: { bun: ">=1.3.12" },
      bin: {
        kalandra: "dist/cli/index.js",
        "kalandra-lsp": "dist/language-server/stdio.js",
      },
      files: [
        "dist",
        "LICENSE",
        "NOTICE",
        "THIRD_PARTY_NOTICES.txt",
        "README.md",
      ],
      repository: {
        type: "git",
        url: "git+https://github.com/kalandra-lang/kalandra.git",
      },
      homepage: "https://kalandra.dev",
      bugs: "https://github.com/kalandra-lang/kalandra/issues",
      funding: "https://opencollective.com/kalandra",
      publishConfig: { access: "public" },
    },
    null,
    2,
  ) + "\n",
);
for (const entry of ["cli/index.js", "language-server/stdio.js"]) {
  const path = join(destination, "dist", entry);
  const source = await readFile(path, "utf8");
  if (!source.startsWith("#!"))
    await Bun.write(path, "#!/usr/bin/env bun\n" + source);
  await chmod(path, 0o755);
}
await Bun.write(
  join(destination, "README.md"),
  `# Kalandra\n\nA functional language and framework for parallel and distributed applications.\n\nRequires Bun 1.3.12 or newer.\n\n\`\`\`sh\nbun add --global @kalandra/cli@${version}\nkalandra new my-app\ncd my-app\nkalandra run src/main.kalandra --strict\n\`\`\`\n\nThe starter returns \`[2, 4, 6]\`. Run \`kalandra --help\` for commands. The package includes the compiler, worker runtime, and \`kalandra-lsp\` language server. Remote services are experimental.\n\n[Documentation](https://kalandra.dev/docs) · [Source](https://github.com/kalandra-lang/kalandra)\n`,
);

// Retain license texts for bundled third-party dependencies, including transitives.
const visited = new Set<string>();
const notices: string[] = [];
async function licenseTree(name: string, from: string) {
  let parent = from;
  let directory = "";
  while (true) {
    const candidate = join(parent, "node_modules", name);
    if (await Bun.file(join(candidate, "package.json")).exists()) {
      directory = await realpath(candidate);
      break;
    }
    const next = resolve(parent, "..");
    if (next === parent)
      throw new Error(`Cannot resolve dependency ${name} from ${from}`);
    parent = next;
  }
  const manifest = await Bun.file(join(directory, "package.json")).json();
  const key = `${manifest.name}@${manifest.version}`;
  if (visited.has(key)) return;
  visited.add(key);
  const texts: string[] = [];
  for (const file of await readdir(directory)) {
    if (/^(licen[sc]e|copying|notice)([.-]|$)/i.test(file)) {
      texts.push(await readFile(join(directory, file), "utf8"));
    }
  }
  if (!texts.length)
    texts.push(
      `Upstream package declares ${manifest.license}; it does not include a license text. Source: ${typeof manifest.repository === "string" ? manifest.repository : (manifest.repository?.url ?? "see npm registry")}`,
    );
  notices.push(
    `${key} (${manifest.license ?? "see license"})\n${texts.join("\n")}`,
  );
  for (const child of Object.keys(manifest.dependencies ?? {}))
    await licenseTree(child, directory);
}
for (const name of ["compiler", "protocol", "language-server"]) {
  const directory = join(root, "packages", name);
  const manifest = await Bun.file(join(directory, "package.json")).json();
  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    if (!dependency.startsWith("@kalandra/"))
      await licenseTree(dependency, directory);
  }
}
await Bun.write(
  join(destination, "THIRD_PARTY_NOTICES.txt"),
  notices.join("\n\n--------------------\n\n"),
);
console.log(`Prepared @kalandra/cli@${version} in ${destination}`);
const pack = Bun.spawn(
  [
    process.execPath,
    "pm",
    "pack",
    "--destination",
    resolve(destination, ".."),
    "--ignore-scripts",
  ],
  { cwd: destination, stdout: "inherit", stderr: "inherit" },
);
if ((await pack.exited) !== 0) throw new Error("Release packing failed");
