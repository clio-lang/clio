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

  await replace(main, mainDisk);
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
