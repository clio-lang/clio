import { resolve } from "node:path";
import { sourceDocumentation } from "@kalandra/compiler";

export async function showSourceDocs(file: string, args: string[]) {
  let name: string | undefined;
  let json = false;
  for (const argument of args) {
    if (argument === "--json" && !json) json = true;
    else if (!argument.startsWith("-") && name === undefined) name = argument;
    else {
      console.error("Usage: kalandra docs <file.kalandra> [function] [--json]");
      process.exitCode = 1;
      return;
    }
  }
  const path = resolve(file);
  let text: string;
  try {
    text = await Bun.file(path).text();
  } catch {
    console.error(`Cannot read source file: ${file}`);
    process.exitCode = 1;
    return;
  }
  const result = sourceDocumentation({ path, text });
  if (!result.functions) {
    for (const diagnostic of result.diagnostics) {
      const offset = diagnostic.span?.start ?? 0;
      const prefix = text.slice(0, offset);
      console.error(
        `${file}:${prefix.split("\n").length}:${offset - prefix.lastIndexOf("\n")} ${diagnostic.code}: ${diagnostic.message}`,
      );
    }
    process.exitCode = 1;
    return;
  }
  const functions =
    name === undefined
      ? result.functions
      : result.functions.filter((fn) => fn.name === name);
  if (name !== undefined && functions.length !== 1) {
    console.error(
      functions.length
        ? `Ambiguous top-level function: ${name}`
        : `No top-level function named ${name} in ${file}`,
    );
    process.exitCode = 1;
    return;
  }
  if (json) {
    console.log(JSON.stringify({ version: 1, file: path, functions }, null, 2));
    return;
  }
  console.log(
    `Source declarations in ${file} (not evaluated or type-checked):`,
  );
  if (!functions.length) console.log("No top-level functions.");
  for (const fn of functions) {
    const line = text.slice(0, fn.span.start).split("\n").length;
    console.log(
      `\n${fn.exported ? "export " : ""}fn ${fn.name}${fn.parameters.length ? " " + fn.parameters.join(" ") : ""} (line ${line})`,
    );
    for (const decorator of fn.decorators) console.log(decorator);
    console.log(
      fn.descriptionStatus === "literal"
        ? fn.description
        : fn.descriptionStatus === "dynamic"
          ? "Description requires evaluation; unavailable statically."
          : "No literal builtin @describe documentation.",
    );
  }
}
