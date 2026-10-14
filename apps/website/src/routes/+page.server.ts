import { homeExamples } from "$lib/playground/home-examples";
import { highlightKalandra } from "../../../../scripts/website-highlighting";
import { compile } from "../../../../packages/compiler/src/compile";
import remoteClient from "../../../../examples/workflows/remote-batch/client/main.kalandra?raw";
import { highlightSnippet } from "$lib/server/highlight";
import invoiceJs from "../../../../examples/workflows/invoices/vendor/invoice-math/index.js?raw";

export async function load() {
  const source = "export fn double value: value * 2\n";
  const compiled = compile(
    { path: "double.kalandra", text: source },
    { strictNames: true },
  );
  if (!compiled.output)
    throw new Error("Homepage JavaScript example failed to compile");
  return {
    lessons: [
      [
        "functions",
        "Functions & pipelines",
        "Compose calls and keep the data flow visible.",
        "10 -> double -> addThree",
      ],
      [
        "collections",
        "Arrays & maps",
        "Transform collections and update their elements.",
        "[1 2 3] -> * double",
      ],
      [
        "types",
        "Types & records",
        "Describe data and check function boundaries.",
        "Point 1.5 2.5",
      ],
      [
        "modules",
        "Modules & imports",
        "Split a program into reusable source files.",
        'from "./math" import double',
      ],
      [
        "parallel",
        "Parallel execution",
        "Dispatch typed work and collect its results.",
        "[1 2 3] -> * [await] |double|",
      ],
      [
        "workflows",
        "Complete workflows",
        "Follow invoices, local batches, and remote calls.",
        "items -> * total",
      ],
    ].map(([slug, title, description, source]) => [
      slug,
      title,
      description,
      highlightKalandra(source),
    ]),
    examples: homeExamples.map((example) => ({
      ...example,
      html: highlightKalandra(example.source),
    })),
    remoteClient: highlightKalandra(remoteClient),
    invoiceJs: await highlightSnippet(invoiceJs, "javascript"),
    commands: await highlightSnippet(
      [
        "kalandra new my-app",
        "kalandra check my-app/src/math.kalandra --strict",
        "kalandra run my-app/src/main.kalandra --strict",
        "kalandra build my-app/src/main.kalandra \\",
        "  -o my-app/build --strict --watch",
      ].join("\n"),
      "bash",
    ),
    compiledSource: highlightKalandra(source),
    javascript: await highlightSnippet(compiled.output.code, "javascript"),
  };
}
