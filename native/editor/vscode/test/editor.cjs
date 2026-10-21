const vscode = require("vscode");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const checks = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function eventually(action, description) {
  const end = Date.now() + 20000;
  let last;
  while (Date.now() < end) {
    try {
      const result = await action();
      if (result) return result;
    } catch (error) {
      last = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out: ${description}${last ? ` (${last})` : ""}`);
}
function position(document, needle, inside = 1) {
  const offset = document.getText().indexOf(needle);
  assert(offset >= 0, `Missing ${needle}`);
  return document.positionAt(offset + inside);
}
async function replace(document, text) {
  const edit = new vscode.WorkspaceEdit();
  edit.replace(
    document.uri,
    new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length),
    ),
    text,
  );
  assert(await vscode.workspace.applyEdit(edit));
}
function clearDiagnostics(document) {
  return eventually(
    () => vscode.languages.getDiagnostics(document.uri).length === 0,
    "diagnostics clear",
  );
}
async function hover(document, needle) {
  return eventually(async () => {
    const values = await vscode.commands.executeCommand(
      "vscode.executeHoverProvider",
      document.uri,
      position(document, needle),
    );
    return values?.length ? values : undefined;
  }, "hover registration/result");
}
function hoverText(values) {
  return values
    .flatMap((value) =>
      value.contents.map((c) => (typeof c === "string" ? c : c.value)),
    )
    .join("\n");
}
function label(item) {
  return typeof item.label === "string" ? item.label : item.label.label;
}
async function complete(document, marked, expected, trigger) {
  const cursor = marked.indexOf("|");
  assert(cursor >= 0);
  await replace(document, marked.replace("|", ""));
  const result = await eventually(async () => {
    const values = await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      document.uri,
      document.positionAt(cursor),
      trigger,
    );
    return values?.items.some((item) => label(item) === expected)
      ? values
      : undefined;
  }, `completion for ${expected}`);
  return result;
}
async function applyCompletion(document, item, oldText, newText) {
  const range = item.textEdit?.range || item.range?.replacing || item.range;
  const text = item.textEdit?.newText || item.insertText;
  assert(range instanceof vscode.Range, "completion replacement range");
  assert.equal(document.getText(range), oldText);
  assert.equal(text, newText);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, range, text);
  assert(await vscode.workspace.applyEdit(edit));
}
async function run() {
  const workspace = process.env.KALANDRA_EDITOR_WORKSPACE;
  const mainUri = vscode.Uri.file(path.join(workspace, "main.k"));
  const libraryUri = vscode.Uri.file(path.join(workspace, "library.k"));
  const mainDisk = await fs.readFile(mainUri.fsPath, "utf8");
  const libraryDisk = await fs.readFile(libraryUri.fsPath, "utf8");
  const extension = vscode.extensions.getExtension(
    "kalandra-lang.kalandra-native",
  );
  assert(extension, "Packed extension not loaded");
  const main = await vscode.workspace.openTextDocument(mainUri);
  await vscode.window.showTextDocument(main);
  await extension.activate();
  assert.equal(main.languageId, "kalandra");
  assert.equal(vscode.workspace.workspaceFolders.length, 2);
  const firstHover = await hover(main, "double(21)");
  assert.match(hoverText(firstHover), /int64/);
  checks.push(
    "Packed VSIX activates for .k and starts the real native server in a multi-root window",
  );

  const definitions = await vscode.commands.executeCommand(
    "vscode.executeDefinitionProvider",
    mainUri,
    position(main, "double(21)"),
  );
  assert(
    definitions.some(
      (value) => (value.uri || value.targetUri).fsPath === libraryUri.fsPath,
    ),
  );
  checks.push("Go to definition follows an imported function to its source");
  const references = await vscode.commands.executeCommand(
    "vscode.executeReferenceProvider",
    mainUri,
    position(main, "double(21)"),
  );
  assert(
    references.some(
      (value) => value.uri.fsPath === path.join(workspace, "caller.k"),
    ),
  );
  assert(!references.some((value) => value.uri.fsPath.endsWith("outsider.k")));
  checks.push(
    "Workspace references find unopened callers and respect the selected root",
  );
  const rename = await vscode.commands.executeCommand(
    "vscode.executeDocumentRenameProvider",
    mainUri,
    position(main, "double(21)"),
    "twice",
  );
  assert(rename instanceof vscode.WorkspaceEdit);
  assert(rename.entries().some(([uri]) => uri.fsPath === libraryUri.fsPath));
  assert(
    rename
      .entries()
      .some(([uri]) => uri.fsPath === path.join(workspace, "caller.k")),
  );
  assert(
    rename
      .entries()
      .flatMap(([, edits]) => edits)
      .every((edit) => edit.newText === "twice"),
  );
  checks.push("Rename reaches the editor as a checked workspace edit proposal");

  await replace(
    main,
    'from "./library.k" import double\nfn main()->int:\n  dou\n',
  );
  const completion = await eventually(async () => {
    const result = await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      mainUri,
      position(main, "dou\n", 3),
    );
    return result?.items.find(
      (item) =>
        (typeof item.label === "string" ? item.label : item.label.label) ===
        "double",
    );
  }, "scope completion");
  assert.equal(completion.textEdit?.newText || completion.insertText, "double");
  checks.push("Partly typed expression names receive native completion");

  const completionUri = vscode.Uri.file(path.join(workspace, "completion.k"));
  const completionLibraryUri = vscode.Uri.file(
    path.join(workspace, "completion-library.k"),
  );
  const completionDocument =
    await vscode.workspace.openTextDocument(completionUri);
  const completionDisk = await fs.readFile(completionUri.fsPath, "utf8");
  const completionLibraryDisk = await fs.readFile(
    completionLibraryUri.fsPath,
    "utf8",
  );
  const imports =
    'from "./completion-library.k" import Box as Crate, Choice as Pick\n';
  let values = await complete(
    completionDocument,
    imports + "fn main():\n  box=Crate {value:1,other:2}\n  box.va|Suffix\n",
    "value",
  );
  let item = values.items.find((item) => label(item) === "value");
  assert.equal(item.kind, vscode.CompletionItemKind.Field);
  await applyCompletion(completionDocument, item, "vaSuffix", "value");
  assert.match(hoverText(await hover(completionDocument, "value\n")), /int64/);
  await clearDiagnostics(completionDocument);
  checks.push(
    "Imported record-field completion applies the full replacement range in VS Code",
  );

  values = await complete(
    completionDocument,
    imports + "fn main():\n  Pick.|\n",
    "Some",
    ".",
  );
  assert.deepEqual(values.items.map(label).sort(), ["Other", "Some"]);
  assert.equal(
    values.items.find((item) => label(item) === "Some").kind,
    vscode.CompletionItemKind.EnumMember,
  );
  values = await complete(
    completionDocument,
    imports + "fn main():\n  Pick.So|Suffix {value:1,count:2}\n",
    "Some",
  );
  await applyCompletion(
    completionDocument,
    values.items.find((item) => label(item) === "Some"),
    "SoSuffix",
    "Some",
  );
  assert.match(hoverText(await hover(completionDocument, "value:1")), /int64/);
  await clearDiagnostics(completionDocument);
  values = await complete(
    completionDocument,
    imports +
      "fn inspect(p:Pick):\n  match p:\n    Pick.Other: 0\n    Pick.| {value:item}: item\n" +
      "fn main():\n  0\n",
    "Some",
    ".",
  );
  assert.deepEqual(values.items.map(label), ["Some"]);
  await applyCompletion(completionDocument, values.items[0], "", "Some");
  assert.match(hoverText(await hover(completionDocument, "item}:")), /int64/);
  await clearDiagnostics(completionDocument);
  checks.push(
    "Enum completion uses EnumMember items and excludes already matched cases in VS Code",
  );

  values = await complete(
    completionDocument,
    imports + "fn main():\n  Crate {|,other:2}\n",
    "value",
    "{",
  );
  assert.deepEqual(values.items.map(label), ["value"]);
  await applyCompletion(completionDocument, values.items[0], "", "value: ");
  assert(completionDocument.getText().includes("Crate {value: ,other:2}"));
  await replace(
    completionDocument,
    completionDocument.getText().replace("value: ,", "value:1,"),
  );
  assert.match(hoverText(await hover(completionDocument, "value:1")), /int64/);
  await clearDiagnostics(completionDocument);
  values = await complete(
    completionDocument,
    imports +
      "fn main():\n  box=Crate {value:1,other:2}\n  box with {va|Suffix:3}\n",
    "value",
  );
  await applyCompletion(
    completionDocument,
    values.items[0],
    "vaSuffix",
    "value",
  );
  assert.match(hoverText(await hover(completionDocument, "value:3")), /int64/);
  await clearDiagnostics(completionDocument);
  values = await complete(
    completionDocument,
    imports + "fn main():\n  Pick.Some {va|Suffix:1,count:2}\n",
    "value",
  );
  assert.deepEqual(values.items.map(label), ["value"]);
  await applyCompletion(
    completionDocument,
    values.items[0],
    "vaSuffix",
    "value",
  );
  assert.match(hoverText(await hover(completionDocument, "value:1")), /int64/);
  await clearDiagnostics(completionDocument);
  checks.push(
    "Record/update/enum payload labels preserve separators and exclude supplied fields in VS Code",
  );

  const pattern =
    imports +
    "fn inspect(p:Pick):\n  match p:\n" +
    "    Pick.Some {count:total,va|Suffix}: value+total\n" +
    "    Pick.Other: 0\nfn main():\n  0\n";
  values = await complete(completionDocument, pattern, "value", ",");
  assert.deepEqual(values.items.map(label), ["value"]);
  await applyCompletion(
    completionDocument,
    values.items[0],
    "vaSuffix",
    "value",
  );
  assert.match(
    hoverText(await hover(completionDocument, "value+total")),
    /int64/,
  );
  await clearDiagnostics(completionDocument);
  values = await complete(
    completionDocument,
    pattern
      .replace("va|Suffix", "va|Suffix:item")
      .replace("value+total", "item+total"),
    "value",
  );
  await applyCompletion(
    completionDocument,
    values.items[0],
    "vaSuffix",
    "value",
  );
  assert(completionDocument.getText().includes("value:item"));
  assert.match(
    hoverText(await hover(completionDocument, "item+total")),
    /int64/,
  );
  await clearDiagnostics(completionDocument);
  checks.push(
    "Match payload completion preserves shorthand and explicit local bindings in VS Code",
  );

  const completionLibrary =
    await vscode.workspace.openTextDocument(completionLibraryUri);
  await replace(
    completionLibrary,
    completionLibraryDisk.replace("value:int", "variable:int"),
  );
  values = await complete(
    completionDocument,
    imports + "fn main():\n  Crate {va|Suffix:1,other:2}\n",
    "variable",
  );
  assert.deepEqual(values.items.map(label), ["variable"]);
  await applyCompletion(
    completionDocument,
    values.items[0],
    "vaSuffix",
    "variable",
  );
  assert.match(
    hoverText(await hover(completionDocument, "variable:1")),
    /int64/,
  );
  await clearDiagnostics(completionDocument);
  assert.equal(await fs.readFile(completionUri.fsPath, "utf8"), completionDisk);
  assert.equal(
    await fs.readFile(completionLibraryUri.fsPath, "utf8"),
    completionLibraryDisk,
  );
  await replace(completionLibrary, completionLibraryDisk);
  await replace(completionDocument, completionDisk);
  checks.push(
    "Member completions follow unsaved imported types without changing disk sources",
  );

  await replace(main, mainDisk);
  const signature = await eventually(async () => {
    const result = await vscode.commands.executeCommand(
      "vscode.executeSignatureHelpProvider",
      mainUri,
      position(main, "double(21)", 8),
      "(",
    );
    return result?.signatures.length ? result : undefined;
  }, "checked signature help");
  assert.equal(
    signature.signatures[0].label,
    "fn double(value: int64) -> int64",
  );
  const parameterLabel = signature.signatures[0].parameters[0].label;
  assert.equal(
    Array.isArray(parameterLabel)
      ? signature.signatures[0].label.slice(...parameterLabel)
      : parameterLabel,
    "value: int64",
  );
  assert.equal(signature.activeParameter, 0);
  checks.push(
    "Signature help exposes the checked imported function and active argument in VS Code",
  );
  await clearDiagnostics(main);
  const library = await vscode.workspace.openTextDocument(libraryUri);
  await replace(
    library,
    "export fn double(value:float32)->float32:\n  value*2\n",
  );
  await eventually(
    () =>
      vscode.languages
        .getDiagnostics(mainUri)
        .some(
          (diagnostic) =>
            diagnostic.severity === vscode.DiagnosticSeverity.Error,
        ),
    "unsaved dependency diagnostics",
  );
  await replace(library, libraryDisk);
  await clearDiagnostics(main);
  checks.push(
    "Unsaved dependency edits recheck callers and clearing errors updates diagnostics",
  );

  const unformatted =
    'from "./library.k" import double\r\n# 😀\r\nfn main( )->int:\r\n    answer=double(21)\r\n    answer';
  await replace(main, unformatted);
  const edits = await vscode.commands.executeCommand(
    "vscode.executeFormatDocumentProvider",
    mainUri,
    { tabSize: 4, insertSpaces: true },
  );
  assert(edits.length > 0); // VS Code can minimize the server's whole-document edit.
  const formatted = new vscode.WorkspaceEdit();
  formatted.set(mainUri, edits);
  assert(await vscode.workspace.applyEdit(formatted));
  assert.equal(
    main.getText(),
    'from "./library.k" import double\n# 😀\nfn main() -> int:\n  answer = double(21)\n  answer\n',
  );
  await clearDiagnostics(main);
  assert.equal(
    (
      await vscode.commands.executeCommand(
        "vscode.executeFormatDocumentProvider",
        mainUri,
        { tabSize: 2, insertSpaces: true },
      )
    )?.length || 0,
    0,
  );
  assert.equal(await fs.readFile(mainUri.fsPath, "utf8"), mainDisk);
  assert.equal(await fs.readFile(libraryUri.fsPath, "utf8"), libraryDisk);
  checks.push(
    "Format Document applies Unicode/CRLF edits, is idempotent and leaves disk files unchanged",
  );

  await replace(main, mainDisk.replace("./library.k", "math"));
  await vscode.workspace
    .getConfiguration("kalandra.native")
    .update(
      "projectPath",
      path.join(workspace, "kalandra.toml"),
      vscode.ConfigurationTarget.Workspace,
    );
  await vscode.commands.executeCommand("kalandra.native.restart");
  await clearDiagnostics(main);
  assert.match(hoverText(await hover(main, "double(21)")), /int64/);
  checks.push(
    "Explicit project configuration restarts the native server and resolves package imports",
  );
  await vscode.commands.executeCommand("kalandra.native.restart");
  assert.match(hoverText(await hover(main, "double(21)")), /int64/);
  checks.push("Manual server restart restores checked editor features");
  await fs.writeFile(
    process.env.KALANDRA_EDITOR_RESULT,
    JSON.stringify(
      {
        vscode: vscode.version,
        platform: process.platform,
        architecture: process.arch,
        extension: extension.packageJSON.version,
        checks,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Kalandra native editor: ${checks.length} real extension-host checks passed.`,
  );
}
module.exports = {
  run: async () => {
    let timer;
    try {
      await Promise.race([
        run(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Native editor test exceeded 90 seconds")),
            90000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  },
};
