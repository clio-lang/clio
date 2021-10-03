#!/usr/bin/env node

import {
  CompletionItemKind,
  Diagnostic,
  DiagnosticSeverity,
  MarkupKind,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
  createConnection,
} from "vscode-languageserver/node";
import { ImportError, ParsingError, parsingError } from "clio-core/errors";
import { MODULES_PATH, getPackageConfig } from "clio-manifest";
import { dirname as _dirname, join, relative, resolve } from "path";
import { parse, tokenize } from "clio-core";

import { TextDocument } from "vscode-languageserver-textdocument";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { inspect } from "util";

const DEBUG_MODE = false;

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

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
  return Diagnostic.create(range, message, DiagnosticSeverity.Error);
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
  const dirname = _dirname(file);
  let currdir = dirname;
  while (true) {
    const up = resolve(currdir, "..");
    if (up === currdir) {
      return "";
    }
    if (existsSync(join(up, "clio.toml"))) {
      return up;
    }
    currdir = up;
  }
}

function getParentProjectRoot(file) {
  const dirname = _dirname(file);
  let currdir = dirname;
  let lastProjectDir = "";
  while (true) {
    const up = resolve(currdir, "..");
    if (up === currdir) {
      return lastProjectDir;
    }
    if (existsSync(join(up, "clio.toml"))) {
      lastProjectDir = up;
    }
    currdir = up;
  }
}

function updateParse(uri, source) {
  connection.console.info(`Parsing ${uri}...`);
  const diagnostics = [];
  try {
    const fileName = fileURLToPath(uri);
    const root = getProjectRoot(fileName);
    const config = getPackageConfig(join(root, "clio.toml"));
    const sourceDir = config.build.source;

    const parent = getParentProjectRoot(fileName);
    const parentConfig = getPackageConfig(join(parent, "clio.toml"));

    const modulesDir = join(parentConfig.build.source, MODULES_PATH);
    const modulesDestDir = join(parentConfig.build.destination, MODULES_PATH);

    const tokens = tokenize(source, {
      file: relative(sourceDir, fileName),
      sourceDir,
      root,
      modulesDir,
      modulesDestDir,
      // These don't make any difference to us:
      destFile: fileName,
      rpcPrefix: "vscode",
    });

    parses.set(uri, linkedListToArray(tokens));

    const parsed = parse(tokens, source, fileName);

    if (DEBUG_MODE) {
      connection.console.log(inspect(parsed));
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
      textDocumentSync: TextDocumentSyncKind.Incremental,
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
    kind: CompletionItemKind.Keyword,
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
      kind: CompletionItemKind.Function,
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
      kind: MarkupKind.PlainText,
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
