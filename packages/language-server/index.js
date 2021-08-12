#!/usr/bin/env node

const ls = require("vscode-languageserver/node");
const doc = require("vscode-languageserver-textdocument");
const url = require("url");
const util = require("util");
const path = require("path");
const fs = require("fs");
const { parse, tokenize } = require("clio-core");
const { parsingError, ParsingError, ImportError } = require("clio-core/errors");
const { getPackageConfig } = require("clio-manifest");

const DEBUG_MODE = false;

const connection = ls.createConnection(ls.ProposedFeatures.all);
const documents = new ls.TextDocuments(doc.TextDocument);

const parses = new Map();

const getMessageFromError = (error) => {
  if (error instanceof ParsingError) {
    return error.meta.parseError;
  }
  if (error instanceof ImportError) {
    return error.meta.importError;
  }
  return error.message;
};

function errorToDiagnostic(error) {
  const { line, column } = error.meta;
  const message = getMessageFromError(error);
  const pos = {
    line: line - 1,
    character: column,
  };
  const range = { start: pos, end: { ...pos, character: 512 } }; // The end character is just an arbitrary large number
  return ls.Diagnostic.create(range, message, ls.DiagnosticSeverity.Error);
}

function linkedListToArray(ll) {
  const arr = [];
  let curr = ll.first;
  while (curr) {
    arr.push(curr.item);
    curr = curr.next;
  }
  return arr;
}

function getProjectRoot(file) {
  const dirname = path.dirname(file);
  let currdir = dirname;
  while (currdir) {
    const up = path.resolve(currdir, "..");
    if (fs.existsSync(path.join(up, "clio.toml"))) {
      return up;
    }
    currdir = up;
  }
  return "";
}

function updateParse(uri, source) {
  connection.console.info(`Parsing ${uri}...`);
  const diagnostics = [];
  try {
    const fileName = url.fileURLToPath(uri);
    const root = getProjectRoot(fileName);
    const config = getPackageConfig(path.join(root, "clio.toml"));
    const sourceDir = config.build.source;

    const tokens = tokenize(source, {
      file: path.relative(sourceDir, fileName),
      sourceDir,
      root,
    });

    parses.set(uri, linkedListToArray(tokens));

    const parsed = parse(tokens, source, fileName);

    if (DEBUG_MODE) {
      connection.console.log(util.inspect(parsed));
    }

    if (parsed.first.item.type !== "clio") {
      throw parsingError(source, fileName, parsed);
    }
  } catch (e) {
    const trace = errorToDiagnostic(e);
    if (trace) {
      diagnostics.push(trace);
    }
  }

  connection.sendDiagnostics({ uri, diagnostics });
}

documents.onDidOpen((ev) => {
  updateParse(ev.document.uri, ev.document.getText());
});

documents.onDidChangeContent((ev) => {
  updateParse(ev.document.uri, ev.document.getText());
});

documents.onDidClose((ev) => {
  parses.delete(ev.document.uri);
});

connection.onInitialize(() => {
  connection.console.info("Initializing Clio language server");
  return {
    capabilities: {
      textDocumentSync: ls.TextDocumentSyncKind.Incremental,
      completionProvider: {},
      hoverProvider: true,
    },
  };
});

connection.onCompletion((params) => {
  const keywordCompletions = [
    "fn",
    "and",
    "or",
    "not",
    "if",
    "else",
    "await",
    "import",
    "export",
    "from",
    "as",
  ].map((kw) => ({
    label: kw,
    kind: ls.CompletionItemKind.Keyword,
  }));

  const stored = parses.get(params.textDocument.uri);

  let functionCompletions = [];
  if (stored) {
    const symbols = [
      ...new Set(
        stored.filter((tok) => tok.type === "symbol").map((tok) => tok.value)
      ),
    ];
    functionCompletions = symbols.map((value) => ({
      label: value,
      kind: ls.CompletionItemKind.Function,
    }));
  }

  return [...keywordCompletions, ...functionCompletions];
});

connection.onHover((params) => {
  const pos = params.position;
  const stored = parses.get(params.textDocument.uri);
  if (!stored) return null;

  const token = stored.tokens.find(
    (tok) =>
      tok.line - 1 === pos.line &&
      pos.character >= tok.column &&
      pos.character < tok.column + tok.value.length
  );
  if (!token) return null;

  return {
    contents: {
      kind: ls.MarkupKind.PlainText,
      value: token.name,
    },
    range: {
      start: { line: token.line - 1, character: token.column },
      end: {
        line: token.line - 1,
        character: token.column + token.value.length,
      },
    },
  };
});

documents.listen(connection);
connection.listen();
