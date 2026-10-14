import { readFile, realpath, stat, open, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { formatSource } from "@kalandra/compiler";

export async function formatFile(
  path: string,
  mode: "stdout" | "check" | "write",
) {
  let temporary: string | undefined;
  try {
    const target = await realpath(path);
    const original = await readFile(target, "utf8");
    const result = formatSource({ path, text: original });
    for (const diagnostic of result.diagnostics) {
      const before = original.slice(0, diagnostic.span?.start ?? 0);
      console.error(
        `${path}:${before.split("\n").length}:${before.length - before.lastIndexOf("\n")} ${diagnostic.code}: ${diagnostic.message}`,
      );
    }
    if (result.text === undefined) {
      process.exitCode = 1;
      return;
    }
    if (mode === "stdout") {
      process.stdout.write(result.text);
      return;
    }
    if (mode === "check") {
      if (result.text !== original) {
        console.error(`Needs formatting: ${path}`);
        process.exitCode = 1;
      }
      return;
    }
    if (result.text !== original) {
      const info = await stat(target);
      temporary = join(
        dirname(target),
        `.${basename(target)}.${randomUUID()}.fmt`,
      );
      const file = await open(temporary, "wx", info.mode);
      try {
        await file.writeFile(result.text, "utf8");
        await file.chmod(info.mode);
      } finally {
        await file.close();
      }
      if ((await readFile(target, "utf8")) !== original)
        throw new Error("Source changed while formatting; retry");
      await rename(temporary, target);
      temporary = undefined;
    }
    console.log(`Formatted ${path}`);
  } catch (error) {
    console.error(
      `Cannot format source: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  } finally {
    if (temporary) await rm(temporary, { force: true });
  }
}
