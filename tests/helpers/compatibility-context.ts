import corpus from "../fixtures/clio/corpus.json";

/** Test-only Kalandra adaptations; original source remains in the pinned corpus. */
export function compatibilityContext(index: number): {
  sources: Record<string, string>;
  expected?: unknown;
  runtimeError?: boolean;
  compileError?: string;
  logs?: number[];
} {
  const fixture = corpus.accepted[index]!;
  // Test-only path adaptation; never change the saved historical corpus.
  const sourceText = fixture.source.replace(/\.clio(?=")/g, ".kalandra");
  if ([140, 141, 142, 155, 156, 160].includes(index)) {
    const probes: Record<number, string> = {
      140: "test.xyz",
      141: "foo.xyz",
      142: "[abc foo.other]",
      155: "[a b c]",
      156: "test.xyz",
      160: "[bye hello]",
    };
    return {
      sources: {
        ".kalandra/modules/test/kalandra.toml": '[build]\nsource = "src"',
        ".kalandra/modules/sub/kalandra.toml": '[build]\nsource = "src"',
        "main.kalandra": sourceText + "\nexport fn main: " + probes[index],
        ".kalandra/modules/test/src/main.kalandra":
          "export xyz = 42\nexport other = 7",
        ".kalandra/modules/sub/src/test.kalandra":
          "export xyz = 42\nexport a = 1\nexport b = 2\nexport c = 3",
        "greetings.kalandra": 'export bye = "bye"\nexport hello = "hello"',
      },
      expected:
        index === 142
          ? [42, 7]
          : index === 155
            ? [1, 2, 3]
            : index === 160
              ? ["bye", "hello"]
              : 42,
    };
  }
  if ([71, 72, 73, 75].includes(index))
    return {
      sources: { "main.kalandra": sourceText },
      compileError: "KAL4001",
    };
  if ([143, 144, 145, 146].includes(index))
    return {
      sources: { "main.kalandra": sourceText },
      compileError: "KAL4103",
    };
  if (index === 172)
    return {
      sources: {
        "main.kalandra":
          "@params Number\n@returns Number\n" +
          sourceText.replace("[39 40 41 42]", "[10 11 12 13]"),
      },
      expected: [undefined, undefined, undefined, undefined],
      logs: [55, 89, 144, 233],
    };
  const scalar = [34, 102, 104, 107, 108].includes(index);
  let prefix = `list Numbers: Number
@params Number Number${index === 34 ? " Number" : ""}
@returns Number
fn add a b${index === 34 ? " c" : ""}: a + b${index === 34 ? " + c" : ""}
@params Number
@returns Number
fn double n: n * 2
${[106, 112, 114].includes(index) ? "@params Number\n@returns Number\n" : [111, 113].includes(index) ? "@params Numbers\n@returns Numbers\n" : ""}fn print value: value
a = ${scalar ? "3" : "[1 2 3]"}
b = 2
c = 1
`;
  if (index === 66)
    return {
      sources: {
        "main.kalandra":
          prefix +
          "@params Number Number\n" +
          sourceText +
          "\nexport fn main: test 1 2",
      },
      expected: 3,
    };
  if (index === 67)
    return {
      sources: {
        "main.kalandra":
          prefix +
          sourceText.replace(
            "  fn inner",
            "  @params Number Number\n  fn inner",
          ) +
          "\nexport fn main: (outer 0) 1 2",
      },
      expected: 3,
    };
  const source =
    prefix +
    "export fn main:\n  result = " +
    sourceText +
    ([103, 105, 109].includes(index) ? "\n  [await] result" : "\n  result");
  return {
    sources: { "main.kalandra": source },
    ...([106, 111, 112].includes(index)
      ? { compileError: "KAL3106" }
      : [108, 113].includes(index)
        ? { runtimeError: true }
        : { expected: scalar ? 6 : [2, 4, 6] }),
  };
}
