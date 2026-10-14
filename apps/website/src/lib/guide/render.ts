import { exampleById } from "./examples.js";

/** Expand explicit placeholders before Tiramisu indexes, renders or exports docs. */
export function renderGuide(template: string): string {
  return template.replace(/\{\{example:([a-z-]+)\}\}/g, (_, id: string) => {
    const example = exampleById(id);
    if (!example) throw new Error(`Unknown guide example: ${id}`);
    const blocks = Object.entries(example.files).map(([path, source]) => {
      if (source.includes('"""'))
        throw new Error("Example contains the documentation quote delimiter");
      return `h3 { ${path} }\n\ncodeblock { language = kalandra, """${source}""" }`;
    });
    blocks.push(
      `Expected result:\n\ncodeblock { language = text, """${JSON.stringify(example.expected)}""" }`,
    );
    if (example.browser)
      blocks.push(
        `link { url = "/docs/playground?example=guide-${example.id}", Try in playground }`,
      );
    else
      blocks.push(
        "This example needs multiple files. Save both files in the same directory and run main.kalandra with the CLI; the playground currently accepts one file.",
      );
    return blocks.join("\n\n");
  });
}
