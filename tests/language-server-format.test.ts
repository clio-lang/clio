import { expect, test } from "bun:test";
import { WorkspaceDocuments } from "../packages/language-server/src/workspace.js";

function workspace() {
  const reports: unknown[] = [];
  const documents = new WorkspaceDocuments(
    {
      locate: () => undefined,
      uri: (_root, path) => path,
      read: async () => {
        throw new Error("Formatting must not read disk");
      },
      isConfiguration: (uri) => uri.endsWith(".json"),
    },
    (report) => reports.push(report),
  );
  return { documents, reports };
}

test("formatting returns a UTF-16 whole-buffer edit without mutating the buffer or diagnostics", async () => {
  const { documents, reports } = workspace();
  const uri = "untitled:format";
  const text = '-- comment\r\nlabel  =  "🌍"';
  await documents.open(uri, "kalandra", 1, text);
  const count = reports.length;
  const edits = await documents.format(uri);
  expect(edits).toEqual([
    {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 1, character: 14 },
      },
      newText: '-- comment\nlabel = "🌍"\n',
    },
  ]);
  expect(await documents.format(uri)).toEqual(edits);
  expect(reports.length).toBe(count);
  await documents.change(uri, 2, [{ text: edits[0]!.newText }]);
  expect(await documents.format(uri)).toEqual([]);
});

test("invalid, unchanged, unknown and configuration documents return no formatting edits", async () => {
  const { documents } = workspace();
  for (const [uri, text] of [
    ["untitled:invalid", "fn broken:"],
    ["untitled:empty", ""],
    ["untitled:ready", "x = 1\n"],
    ["file:///config.json", '{"a":1}'],
  ]) {
    await documents.open(uri!, "kalandra", 1, text!);
    expect(await documents.format(uri!)).toEqual([]);
  }
  expect(await documents.format("untitled:unknown")).toEqual([]);
  await documents.open("untitled:blank", "kalandra", 1, " \r\n ");
  expect((await documents.format("untitled:blank"))[0]?.newText).toBe("");
});

test("formatting discards changed, closed, reopened and disposed snapshots", async () => {
  for (const action of ["change", "close", "reopen", "dispose"]) {
    const { documents } = workspace();
    const uri = "untitled:format";
    await documents.open(uri, "kalandra", 1, "x=1");
    const pending = documents.format(uri);
    if (action === "change") await documents.change(uri, 2, [{ text: "x=2" }]);
    if (action === "close") await documents.close(uri);
    if (action === "reopen") {
      const closing = documents.close(uri);
      const opening = documents.open(uri, "kalandra", 1, "x=2");
      await Promise.all([closing, opening]);
    }
    if (action === "dispose") documents.dispose();
    expect(await pending).toEqual([]);
  }
});

test("unrelated buffer changes do not invalidate formatting", async () => {
  const { documents } = workspace();
  await documents.open("untitled:a", "kalandra", 1, "x=1");
  const pending = documents.format("untitled:a");
  await documents.open("untitled:b", "kalandra", 1, "y=2");
  expect((await pending)[0]?.newText).toBe("x = 1\n");
});
