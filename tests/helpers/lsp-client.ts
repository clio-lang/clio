import { externalPackage, numberFunction } from "./external-types-cli.js";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

/** Exercise framed stdio, not an in-process imitation of the server. */
export async function verifyLanguageServer(
  entry: string,
  cwd?: string,
  versionedEdits = false,
) {
  const project = await mkdtemp(join(tmpdir(), "kalandra-lsp-project-"));
  await writeFile(join(project, "value.kalandra"), "export value = 1");
  await mkdir(join(project, "ignored"));
  await writeFile(join(project, "ignored/broken.kalandra"), "fn broken:");
  await writeFile(join(project, "broken.skip.kalandra"), "fn broken:");
  const child = spawn(process.execPath, [entry], {
    ...(cwd ? { cwd } : {}),
    stdio: "pipe",
  });
  const inbox: any[] = [];
  let bytes = Buffer.alloc(0),
    stderr = "";
  let wake: (() => void) | undefined;
  let ended = false;
  const exited = new Promise<number | null>((resolve) => {
    child.on("exit", (code) => {
      ended = true;
      wake?.();
      resolve(code);
    });
  });
  child.stderr.on("data", (data) => {
    stderr += data;
  });
  child.stdout.on("data", (data) => {
    bytes = Buffer.concat([bytes, data]);
    for (;;) {
      const boundary = bytes.indexOf("\r\n\r\n");
      if (boundary < 0) return;
      const length = /Content-Length: (\d+)/i.exec(
        bytes.subarray(0, boundary).toString(),
      )?.[1];
      if (!length) {
        stderr += "Invalid stdout frame";
        child.kill();
        return;
      }
      const end = boundary + 4 + Number(length);
      if (bytes.length < end) return;
      inbox.push(JSON.parse(bytes.subarray(boundary + 4, end).toString()));
      bytes = bytes.subarray(end);
      wake?.();
    }
  });
  const send = (message: object, fragmented = false) => {
    const body = JSON.stringify({ jsonrpc: "2.0", ...message });
    const frame = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
    if (fragmented) {
      child.stdin.write(frame.slice(0, 12));
      child.stdin.write(frame.slice(12));
    } else child.stdin.write(frame);
  };
  const receive = async (
    predicate: (message: any) => boolean,
  ): Promise<any> => {
    const deadline = Date.now() + 5000;
    for (;;) {
      const index = inbox.findIndex(predicate);
      if (index >= 0) return inbox.splice(index, 1)[0];
      if (ended || Date.now() >= deadline)
        throw new Error(`Missing LSP response: ${stderr}`);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(
          () => {
            wake = undefined;
            resolve();
          },
          Math.max(1, deadline - Date.now()),
        );
        wake = () => {
          clearTimeout(timer);
          wake = undefined;
          resolve();
        };
      });
    }
  };
  try {
    send(
      {
        id: 1,
        method: "initialize",
        params: {
          processId: null,
          rootUri: pathToFileURL(project).href,
          capabilities: {
            workspace: { workspaceEdit: { documentChanges: versionedEdits } },
          },
          initializationOptions: {
            strictNames: true,
            sourceExcludes: ["ignored/**", "**/*.skip.kalandra"],
          },
        },
      },
      true,
    );
    const initialized = await receive((message) => message.id === 1);
    assert.equal(initialized.result.capabilities.positionEncoding, "utf-16");
    assert.equal(initialized.result.capabilities.definitionProvider, true);
    assert.equal(initialized.result.capabilities.referencesProvider, true);
    assert.deepEqual(initialized.result.capabilities.renameProvider, {
      prepareProvider: true,
    });
    assert.equal(initialized.result.capabilities.hoverProvider, true);
    assert.deepEqual(
      initialized.result.capabilities.completionProvider.triggerCharacters,
      ["."],
    );
    assert.equal(initialized.result.capabilities.textDocumentSync.change, 2);
    send({ method: "initialized", params: {} });
    const uri = "untitled:kalandra-lsp-smoke";
    send({
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri,
          languageId: "kalandra",
          version: 1,
          text: 'label = "🌍"\r\nNumber n = "bad"',
        },
      },
    });
    const first = await receive(
      (message) => message.method === "textDocument/publishDiagnostics",
    );
    assert.equal(first.params.uri, uri);
    assert.equal(first.params.version, 1);
    assert.equal(first.params.diagnostics[0].code, "KAL3111");
    assert.equal(first.params.diagnostics[0].range.start.line, 1);
    send({
      method: "textDocument/didChange",
      params: {
        textDocument: { uri, version: 2 },
        contentChanges: [
          {
            range: {
              start: { line: 1, character: 11 },
              end: { line: 1, character: 16 },
            },
            text: "42",
          },
        ],
      },
    });
    const second = await receive(
      (message) => message.method === "textDocument/publishDiagnostics",
    );
    assert.equal(second.params.version, 2);
    assert.deepEqual(second.params.diagnostics, []);
    send({
      method: "textDocument/didClose",
      params: { textDocument: { uri } },
    });
    const closed = await receive(
      (message) => message.method === "textDocument/publishDiagnostics",
    );
    assert.deepEqual(closed.params.diagnostics, []);
    const mainUri = pathToFileURL(join(project, "main.kalandra")).href;
    const valueUri = pathToFileURL(join(project, "value.kalandra")).href;
    send({
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri: mainUri,
          languageId: "kalandra",
          version: 1,
          text: 'from "./value" import value\nNumber result = value',
        },
      },
    });
    const clean = await receive(
      (m) =>
        m.method === "textDocument/publishDiagnostics" &&
        m.params.uri === mainUri,
    );
    assert.deepEqual(clean.params.diagnostics, []);
    send({
      id: 3,
      method: "textDocument/definition",
      params: {
        textDocument: { uri: mainUri },
        position: { line: 1, character: 17 },
      },
    });
    const definition = await receive((message) => message.id === 3);
    send({
      id: 4,
      method: "textDocument/hover",
      params: {
        textDocument: { uri: mainUri },
        position: { line: 1, character: 17 },
      },
    });
    const hover = await receive((message) => message.id === 4);
    assert.deepEqual(hover.result.contents, {
      kind: "plaintext",
      value: "value: Number",
    });
    assert.deepEqual(hover.result.range, {
      start: { line: 1, character: 16 },
      end: { line: 1, character: 21 },
    });
    send({
      id: 5,
      method: "textDocument/completion",
      params: {
        textDocument: { uri: mainUri },
        position: { line: 1, character: 18 },
      },
    });
    const completion = await receive((message) => message.id === 5);
    assert.equal(completion.result.length, 1);
    assert.equal(completion.result[0].label, "value");
    assert.equal(completion.result[0].detail, "Number");
    assert.deepEqual(completion.result[0].textEdit, {
      range: {
        start: { line: 1, character: 16 },
        end: { line: 1, character: 21 },
      },
      newText: "value",
    });
    send({
      id: 6,
      method: "textDocument/references",
      params: {
        textDocument: { uri: mainUri },
        position: { line: 1, character: 18 },
        context: { includeDeclaration: true },
      },
    });
    const references = await receive((message) => message.id === 6);
    assert.deepEqual(references.result, [
      {
        uri: mainUri,
        range: {
          start: { line: 0, character: 22 },
          end: { line: 0, character: 27 },
        },
      },
      {
        uri: mainUri,
        range: {
          start: { line: 1, character: 16 },
          end: { line: 1, character: 21 },
        },
      },
      {
        uri: valueUri,
        range: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 12 },
        },
      },
    ]);
    send({
      id: 7,
      method: "textDocument/prepareRename",
      params: {
        textDocument: { uri: mainUri },
        position: { line: 1, character: 18 },
      },
    });
    const prepare = await receive((message) => message.id === 7);
    assert.deepEqual(prepare.result, {
      range: {
        start: { line: 1, character: 16 },
        end: { line: 1, character: 21 },
      },
      placeholder: "value",
    });
    send({
      id: 8,
      method: "textDocument/rename",
      params: {
        textDocument: { uri: mainUri },
        position: { line: 1, character: 18 },
        newName: "answer",
      },
    });
    const renamed = await receive((message) => message.id === 8);
    if (versionedEdits) {
      assert.equal(
        renamed.result.documentChanges.find(
          (change: any) => change.textDocument.uri === mainUri,
        ).textDocument.version,
        1,
      );
      assert.equal(
        renamed.result.documentChanges.find(
          (change: any) => change.textDocument.uri === valueUri,
        ).textDocument.version,
        null,
      );
      renamed.result.changes = Object.fromEntries(
        renamed.result.documentChanges.map((change: any) => [
          change.textDocument.uri,
          change.edits,
        ]),
      );
    }
    // Verify the exact edits for both supported WorkspaceEdit representations.
    assert.deepEqual(renamed.result.changes[mainUri], [
      {
        range: {
          start: { line: 0, character: 22 },
          end: { line: 0, character: 27 },
        },
        newText: "answer",
      },
      {
        range: {
          start: { line: 1, character: 16 },
          end: { line: 1, character: 21 },
        },
        newText: "answer",
      },
    ]);
    assert.deepEqual(renamed.result.changes[valueUri], [
      {
        range: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 12 },
        },
        newText: "answer",
      },
    ]);
    send({
      id: 9,
      method: "textDocument/rename",
      params: {
        textDocument: { uri: mainUri },
        position: { line: 1, character: 18 },
        newName: "result",
      },
    });
    const conflict = await receive((message) => message.id === 9);
    assert.equal(conflict.error.code, -32602);
    await writeFile(
      join(project, "unopened.kalandra"),
      'from "./value" import value\nvalue',
    );
    const unopenedUri = pathToFileURL(join(project, "unopened.kalandra")).href;
    send({
      id: 10,
      method: "textDocument/references",
      params: {
        textDocument: { uri: mainUri },
        position: { line: 1, character: 18 },
        context: { includeDeclaration: true },
      },
    });
    const discoveredReferences = await receive((message) => message.id === 10);
    assert.equal(discoveredReferences.result.length, 5);
    assert.equal(
      discoveredReferences.result.filter(
        (item: any) => item.uri === unopenedUri,
      ).length,
      2,
    );
    send({
      id: 11,
      method: "textDocument/rename",
      params: {
        textDocument: { uri: mainUri },
        position: { line: 1, character: 18 },
        newName: "shared",
      },
    });
    const discoveredRename = await receive((message) => message.id === 11);
    const unopenedEdits = versionedEdits
      ? discoveredRename.result.documentChanges.find(
          (change: any) => change.textDocument.uri === unopenedUri,
        ).edits
      : discoveredRename.result.changes[unopenedUri];
    assert.deepEqual(unopenedEdits, [
      {
        range: {
          start: { line: 0, character: 22 },
          end: { line: 0, character: 27 },
        },
        newText: "shared",
      },
      {
        range: {
          start: { line: 1, character: 0 },
          end: { line: 1, character: 5 },
        },
        newText: "shared",
      },
    ]);
    assert.deepEqual(definition.result, {
      uri: valueUri,
      range: {
        start: { line: 0, character: 7 },
        end: { line: 0, character: 12 },
      },
    });
    send({
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri: valueUri,
          languageId: "kalandra",
          version: 1,
          text: 'export value = "changed"',
        },
      },
    });
    const changed = await receive(
      (m) =>
        m.method === "textDocument/publishDiagnostics" &&
        m.params.uri === mainUri,
    );
    assert.equal(changed.params.diagnostics[0].code, "KAL3111");
    send({
      method: "textDocument/didClose",
      params: { textDocument: { uri: valueUri } },
    });
    const restored = await receive(
      (m) =>
        m.method === "textDocument/publishDiagnostics" &&
        m.params.uri === mainUri,
    );
    assert.deepEqual(restored.params.diagnostics, []);
    await mkdir(join(project, ".kalandra/modules/math/src"), {
      recursive: true,
    });
    await writeFile(
      join(project, ".kalandra/modules/math/kalandra.toml"),
      '[build]\nsource = "src"',
    );
    await writeFile(
      join(project, ".kalandra/modules/math/src/main.kalandra"),
      "export answer = 42",
    );
    const packageUri = pathToFileURL(join(project, "package.kalandra")).href;
    send({
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri: packageUri,
          languageId: "kalandra",
          version: 1,
          text: 'from "math" import answer\nanswer',
        },
      },
    });
    const packageDiagnostics = await receive(
      (message) =>
        message.method === "textDocument/publishDiagnostics" &&
        message.params.uri === packageUri,
    );
    assert.deepEqual(packageDiagnostics.params.diagnostics, []);
    send({
      id: 12,
      method: "textDocument/definition",
      params: {
        textDocument: { uri: packageUri },
        position: { line: 1, character: 1 },
      },
    });
    const packageDefinition = await receive((message) => message.id === 12);
    assert.equal(
      packageDefinition.result.uri,
      pathToFileURL(join(project, ".kalandra/modules/math/src/main.kalandra"))
        .href,
    );
    send({
      id: 13,
      method: "textDocument/rename",
      params: {
        textDocument: { uri: packageUri },
        position: { line: 1, character: 1 },
        newName: "total",
      },
    });
    const packageRename = await receive((message) => message.id === 13);
    assert.ok(packageRename.result);
    const packageChanges = versionedEdits
      ? packageRename.result.documentChanges.map(
          (item: any) => item.textDocument.uri,
        )
      : Object.keys(packageRename.result.changes);
    assert.equal(packageChanges.length, 2);
    assert.ok(packageChanges.includes(packageDefinition.result.uri));
    // A nested manifest project uses its source root, then changes roots on a watched-file event.
    const manifestRoot = join(project, "manifest-project");
    await mkdir(join(manifestRoot, "src/nested"), { recursive: true });
    const manifestPath = join(manifestRoot, "kalandra.toml");
    await writeFile(manifestPath, '[build]\nsource = "src"');
    await writeFile(
      join(manifestRoot, "src/value.kalandra"),
      "export answer = 1",
    );
    await writeFile(
      join(manifestRoot, "src/nested/value.kalandra"),
      "export answer = 2",
    );
    const nestedUri = pathToFileURL(
      join(manifestRoot, "src/nested/main.kalandra"),
    ).href;
    send({
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri: nestedUri,
          languageId: "kalandra",
          version: 1,
          text: 'from "/value" import answer\nanswer',
        },
      },
    });
    const nestedReport = await receive(
      (message) =>
        message.method === "textDocument/publishDiagnostics" &&
        message.params.uri === nestedUri,
    );
    assert.deepEqual(nestedReport.params.diagnostics, []);
    send({
      id: 14,
      method: "textDocument/definition",
      params: {
        textDocument: { uri: nestedUri },
        position: { line: 1, character: 1 },
      },
    });
    assert.equal(
      (await receive((message) => message.id === 14)).result.uri,
      pathToFileURL(join(manifestRoot, "src/value.kalandra")).href,
    );
    await writeFile(manifestPath, '[build]\nsource = "src/nested"');
    send({
      method: "workspace/didChangeWatchedFiles",
      params: { changes: [{ uri: pathToFileURL(manifestPath).href, type: 2 }] },
    });
    const refreshedReport = await receive(
      (message) =>
        message.method === "textDocument/publishDiagnostics" &&
        message.params.uri === nestedUri,
    );
    assert.deepEqual(refreshedReport.params.diagnostics, []);
    send({
      id: 15,
      method: "textDocument/definition",
      params: {
        textDocument: { uri: nestedUri },
        position: { line: 1, character: 1 },
      },
    });
    assert.equal(
      (await receive((message) => message.id === 15)).result.uri,
      pathToFileURL(join(manifestRoot, "src/nested/value.kalandra")).href,
    );
    const externalDirectory = await externalPackage(project);
    const externalUri = pathToFileURL(
      join(project, "external-main.kalandra"),
    ).href;
    send({
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri: externalUri,
          languageId: "kalandra",
          version: 1,
          text: 'from "esm:typed-lib" import make as local\nlocal 1',
        },
      },
    });
    const externalReport = await receive(
      (message) =>
        message.method === "textDocument/publishDiagnostics" &&
        message.params.uri === externalUri,
    );
    assert.deepEqual(externalReport.params.diagnostics, []);
    send({
      id: 16,
      method: "textDocument/hover",
      params: {
        textDocument: { uri: externalUri },
        position: { line: 1, character: 1 },
      },
    });
    assert.match(
      (await receive((message) => message.id === 16)).result.contents.value,
      /Number/,
    );
    send({
      id: 17,
      method: "textDocument/rename",
      params: {
        textDocument: { uri: externalUri },
        position: { line: 1, character: 1 },
        newName: "renamed",
      },
    });
    assert.ok((await receive((message) => message.id === 17)).result);
    const externalTypes = join(externalDirectory, "kalandra.types.json");
    await writeFile(
      externalTypes,
      JSON.stringify({
        version: 1,
        modules: {
          "esm:.": {
            exports: { make: { ...numberFunction, parameters: ["String"] } },
          },
        },
      }),
    );
    send({
      method: "workspace/didChangeWatchedFiles",
      params: {
        changes: [{ uri: pathToFileURL(externalTypes).href, type: 2 }],
      },
    });
    const externalChanged = await receive(
      (message) =>
        message.method === "textDocument/publishDiagnostics" &&
        message.params.uri === externalUri,
    );
    assert.ok(
      externalChanged.params.diagnostics.some(
        (diagnostic: any) => diagnostic.code === "KAL3106",
      ),
    );
    assert.equal(
      initialized.result.capabilities.documentFormattingProvider,
      true,
    );
    const formatPath = join(project, "format.kalandra");
    const formatUri = pathToFileURL(formatPath).href;
    await writeFile(formatPath, "disk = 0");
    const formatText = '-- comment\r\nlabel  =  "🌍"';
    send({
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri: formatUri,
          languageId: "kalandra",
          version: 1,
          text: formatText,
        },
      },
    });
    await receive(
      (message) =>
        message.method === "textDocument/publishDiagnostics" &&
        message.params.uri === formatUri &&
        message.params.version === 1,
    );
    const formatRequest = async (id: number) => {
      send({
        id,
        method: "textDocument/formatting",
        params: {
          textDocument: { uri: formatUri },
          options: { tabSize: 2, insertSpaces: true },
        },
      });
      return (await receive((message) => message.id === id)).result;
    };
    const formatted = await formatRequest(18);
    assert.deepEqual(formatted, [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 1, character: 14 },
        },
        newText: '-- comment\nlabel = "🌍"\n',
      },
    ]);
    assert.deepEqual(await formatRequest(19), formatted);
    for (const [version, text] of [
      [2, formatted[0]!.newText],
      [3, "fn broken:"],
    ] as const) {
      send({
        method: "textDocument/didChange",
        params: {
          textDocument: { uri: formatUri, version },
          contentChanges: [{ text }],
        },
      });
      await receive(
        (message) =>
          message.method === "textDocument/publishDiagnostics" &&
          message.params.uri === formatUri &&
          message.params.version === version,
      );
      assert.deepEqual(await formatRequest(18 + version), []);
    }
    assert.equal(await Bun.file(formatPath).text(), "disk = 0");
    send({ id: 2, method: "shutdown", params: null });
    assert.equal((await receive((message) => message.id === 2)).result, null);
    send({ method: "exit" });
    const code = await Promise.race([
      exited,
      new Promise<never>((_, reject) => {
        const timer = setTimeout(
          () => reject(new Error("LSP failed to exit")),
          3000,
        );
        timer.unref();
      }),
    ]);
    assert.equal(code, 0, stderr);
  } finally {
    child.kill();
    await exited;
    await rm(project, { recursive: true, force: true });
  }
}
