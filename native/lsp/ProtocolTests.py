"""Independent stdlib-only, framed stdio tests for the native language server."""
import json
import os
from pathlib import Path
import select
import subprocess
import sys
import tempfile
import time

SERVER = sys.argv[1]
ROOT = Path(sys.argv[2])
ROOT.mkdir(parents=True, exist_ok=True)


def frame(value):
    data = json.dumps(value, ensure_ascii=False).encode()
    return f"Content-Length: {len(data)}\r\n\r\n".encode() + data


class Client:
    def __init__(self, *args):
        self.process = subprocess.Popen([SERVER, *args], stdin=subprocess.PIPE,
                                        stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.buffer = b""
        self.serial = 0
        self.events = []

    def send(self, method, params=None, ident=None):
        value = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            value["params"] = params
        if ident is not None:
            value["id"] = ident
        self.process.stdin.write(frame(value))
        self.process.stdin.flush()

    def read(self):
        deadline = time.monotonic() + 20
        while True:
            if b"\r\n\r\n" in self.buffer:
                header, body = self.buffer.split(b"\r\n\r\n", 1)
                length = int(header.decode().split(":", 1)[1].strip())
                if len(body) >= length:
                    self.buffer = body[length:]
                    value = json.loads(body[:length])
                    assert value["jsonrpc"] == "2.0"
                    return value
            remaining = deadline - time.monotonic()
            assert remaining > 0, "server response timed out"
            assert select.select([self.process.stdout], [], [], remaining)[0], "server stalled"
            data = os.read(self.process.stdout.fileno(), 65536)
            assert data, "server exited before response"
            self.buffer += data

    def rpc(self, method, params=None):
        self.serial += 1
        self.send(method, params, self.serial)
        while True:
            value = self.read()
            if value.get("id") == self.serial:
                return value
            self.events.append(value)

    def barrier(self):
        assert self.rpc("test/barrier")["error"]["code"] == -32601
        events, self.events = self.events, []
        return events

    def init(self, formats=None):
        capabilities = {} if formats is None else {"textDocument": {"hover": {"contentFormat": formats}}}
        result = self.rpc("initialize", {"capabilities": capabilities})["result"]
        caps = result["capabilities"]
        assert caps["positionEncoding"] == "utf-16"
        assert caps["textDocumentSync"]["change"] == 2  # Incremental UTF-16 changes.
        assert caps["hoverProvider"] is True
        assert caps["definitionProvider"] is True
        assert caps["referencesProvider"] is True
        assert not caps.get("completionProvider")
        self.send("initialized", {})

    def open(self, path, text, version=1):
        self.send("textDocument/didOpen", {"textDocument": {
            "uri": path.as_uri(), "languageId": "kalandra", "version": version, "text": text}})

    def change(self, path, text, version):
        self.send("textDocument/didChange", {"textDocument": {
            "uri": path.as_uri(), "version": version}, "contentChanges": [{"text": text}]})

    def edits(self, path, changes, version):
        self.send("textDocument/didChange", {"textDocument": {
            "uri": path.as_uri(), "version": version}, "contentChanges": changes})

    def hover(self, path, line, character):
        return self.rpc("textDocument/hover", {"textDocument": {"uri": path.as_uri()},
                                              "position": {"line": line, "character": character}})

    def definition(self, path, line, character):
        return self.rpc("textDocument/definition", {"textDocument": {"uri": path.as_uri()},
                                                   "position": {"line": line, "character": character}})

    def references(self, path, line, character, include=False):
        return self.rpc("textDocument/references", {"textDocument": {"uri": path.as_uri()},
            "position": {"line": line, "character": character},
            "context": {"includeDeclaration": include}})

    def close(self, path):
        self.send("textDocument/didClose", {"textDocument": {"uri": path.as_uri()}})

    def finish(self):
        assert self.rpc("shutdown")["result"] is None
        self.send("exit")
        self.process.stdin.close()
        assert self.process.wait(timeout=10) == 0
        assert self.process.stdout.read() == b"", "unexpected trailing protocol data"
        assert self.process.stderr.read() == b"", "unexpected server diagnostics/sanitizer output"


def edit(line, start, end, text, **extra):
    return {"range": {"start": {"line": line, "character": start},
                      "end": {"line": line, "character": end}}, "text": text, **extra}


def publications(events):
    result = {}
    for value in events:
        if value.get("method") == "textDocument/publishDiagnostics":
            params = value["params"]
            result[params["uri"]] = params
    return result


def invalid_stream(data, expected=2):
    result = subprocess.run([SERVER], input=data, capture_output=True, timeout=20)
    assert result.returncode == expected, (result.returncode, result.stderr)
    assert result.stdout == b""
    assert b"Sanitizer" not in result.stderr and b"runtime error:" not in result.stderr


with tempfile.TemporaryDirectory(dir=ROOT) as temp:
    root = Path(temp).resolve()
    main = root / 'new space#é.k'
    good = "fn main()->int:\n  42\n"
    client = Client()
    assert client.rpc("textDocument/hover", {})["error"]["code"] == -32002
    client.init()
    assert client.rpc("initialize", {})["error"]["code"] == -32600
    client.open(main, 'fn main()->String:\n  "😀é" + missing\n')
    pub = publications(client.barrier())[main.as_uri()]
    assert pub["version"] == 1
    diagnostic = pub["diagnostics"][0]
    assert diagnostic["code"] == "S016" and diagnostic["severity"] == 1
    assert diagnostic["range"] == {"start": {"line": 1, "character": 10},
                                   "end": {"line": 1, "character": 17}}
    client.change(main, good.replace("\n", "\r\n"), 2)
    pub = publications(client.barrier())[main.as_uri()]
    assert pub["version"] == 2 and not pub["diagnostics"]
    client.change(main, "bad", 1)  # Old snapshots cannot replace new text.
    assert not publications(client.barrier())
    client.send("textDocument/didChange", {"textDocument": {"uri": main.as_uri(), "version": 3},
        "contentChanges": [{"range": {"start": {"line": 0, "character": 0},
                                      "end": {"line": 9, "character": 1}}, "text": "bad"}]})
    assert any(e.get("method") == "window/logMessage" for e in client.barrier())
    client.change(main, "bad", 9.223372036854776e18)
    assert any(e.get("method") == "window/logMessage" for e in client.barrier())
    client.change(main, good, 3)  # Invalid change did not consume the version.
    assert not publications(client.barrier())[main.as_uri()]["diagnostics"]
    # New-file normalized URI identity also rejects duplicate opens.
    alias_uri = main.as_uri().replace("/new", "/./new")
    client.send("textDocument/didOpen", {"textDocument": {"uri": alias_uri,
        "version": 1, "languageId": "kalandra", "text": "bad"}})
    assert any(e.get("method") == "window/logMessage" for e in client.barrier())
    client.change(main, " " * (16 * 1024 * 1024), 4)
    assert any(e.get("method") == "window/logMessage" for e in client.barrier())
    client.change(main, good, 4)
    assert not publications(client.barrier())[main.as_uri()]["diagnostics"]
    client.close(main)
    assert not publications(client.barrier())[main.as_uri()]["diagnostics"]
    assert not main.exists(), "server wrote an unsaved file"
    client.finish()

    # Incremental UTF-16 edits over CRLF, sequential ranges and transactional rollback.
    client = Client()
    client.init()
    client.open(main, 'fn main()->String:\r\n  "😀é" + missing\r\n')
    client.barrier()
    client.edits(main, [edit(1, 3, 5, "猫", rangeLength=2), edit(1, 9, 16, '"ok"')], 2)
    assert not publications(client.barrier())[main.as_uri()]["diagnostics"]
    client.edits(main, [{"text": "bad"}, edit(999, 0, 0, "x")], 3)
    assert any(e.get("method") == "window/logMessage" for e in client.barrier())
    client.edits(main, [edit(1, 9, 13, "missing")], 3)
    pub = publications(client.barrier())[main.as_uri()]
    assert pub["version"] == 3 and pub["diagnostics"][0]["code"] == "S016"
    assert pub["diagnostics"][0]["range"]["start"]["character"] == 9
    client.edits(main, [edit(1, 3, 4, "😀"), edit(1, 10, 17, '"ok"')], 4)
    assert not publications(client.barrier())[main.as_uri()]["diagnostics"]
    invalid_changes = [
        [edit(1, 3, 4, "x")],  # Half of a surrogate pair.
        [edit(1, 5, 3, "x")],
        [edit(-1, 0, 0, "x")],
        [edit(1, 0.5, 0.5, "x")],
        [edit(9.223372036854776e18, 0, 0, "x")],
        [edit(1, 3, 5, "x", rangeLength=1)],
        [{"text": "bad", "range": None}],
        [{"text": "bad", "rangeLength": 0}],
        [edit(1, 0, 0, "")] * 1025,
    ]
    for changes in invalid_changes:
        client.edits(main, changes, 5)
        events = client.barrier()
        assert not publications(events) and any(e.get("method") == "window/logMessage" for e in events)
    client.edits(main, [], 5)  # Valid no-op still advances the document version.
    assert publications(client.barrier())[main.as_uri()]["version"] == 5
    client.edits(main, [edit(999, 0, 0, "bad")], 4)  # Stale even when malformed.
    assert not client.barrier()
    client.edits(main, [{"text": good}, edit(1, 200, 200, " ")], 6)
    assert not publications(client.barrier())[main.as_uri()]["diagnostics"]
    client.finish()

    # Open dependencies, changed export signatures, deduplication and close-to-disk.
    lib = root / "lib.k"
    lib.write_text("export fn value()->int:\n  42\n")
    main = root / "main.k"
    caller = 'from "./lib.k" import value\nfn main()->int:\n  value()\n'
    client = Client()
    client.init()
    client.open(lib, lib.read_text())
    client.open(main, caller)
    assert not publications(client.barrier())[main.as_uri()]["diagnostics"]
    client.edits(lib, [edit(0, 19, 22, "String"), edit(1, 2, 4, '"text"')], 2)
    assert publications(client.barrier())[main.as_uri()]["diagnostics"]
    client.change(main, caller.replace("->int", "->String"), 2)
    assert not publications(client.barrier())[main.as_uri()]["diagnostics"]
    client.change(lib, 'export fn value()->String:\n  missing\n', 3)
    pub = publications(client.barrier())[lib.as_uri()]
    assert len(pub["diagnostics"]) == 1 and pub["version"] == 3
    client.close(lib)
    pubs = publications(client.barrier())
    assert pubs[main.as_uri()]["diagnostics"]  # Reverts to int from disk.
    assert not pubs[lib.as_uri()]["diagnostics"] and "version" not in pubs[lib.as_uri()]
    assert lib.read_text() == "export fn value()->int:\n  42\n"
    client.close(main)
    assert not publications(client.barrier())[main.as_uri()]["diagnostics"]
    client.finish()

    # Diagnostics in unopened imports, then clearing when an unsaved import fixes it.
    lib.write_text("export fn value()->int:\n  missing\n")
    client = Client()
    client.init()
    client.open(main, caller)
    pubs = publications(client.barrier())
    assert pubs[lib.as_uri()]["diagnostics"] and "version" not in pubs[lib.as_uri()]
    client.open(lib, "export fn value()->int:\n  42\n")
    assert not publications(client.barrier())[lib.as_uri()]["diagnostics"]
    client.close(main)
    client.close(lib)
    client.barrier()
    client.finish()

    # Placement mode uses the shared checker without accessing GPU hardware.
    placement = ("fn double(x:float32)->float32:\n  x*2\n"
                 "fn main()->float32 ! TaskError:\n  try parallel:\n"
                 "    try await spawn double(2) on devices.gpu()\n")
    for args, expected_error in (((), True), (("--placement",), False)):
        client = Client(*args)
        client.init()
        client.open(main, placement)
        assert bool(publications(client.barrier())[main.as_uri()]["diagnostics"]) == expected_error
        client.finish()

    # Explicit project package mappings and no startup source execution.
    lib.write_text("export fn value()->int:\n  42\n")
    manifest = root / "kalandra.toml"
    manifest.write_text('format=1\n[project]\nentry="main.k"\n[packages]\nmath="lib.k"\n')
    main.write_text(caller.replace('"./lib.k"', '"math"'))
    client = Client("--project", str(manifest))
    client.init()
    client.open(main, main.read_text())
    assert not publications(client.barrier())[main.as_uri()]["diagnostics"]
    client.change(main, "fn main()->int:\n  missing\n", 2)
    assert publications(client.barrier())[main.as_uri()]["diagnostics"]
    client.finish()

    # URI spelling changes must clear the exact previously published URI.
    client = Client()
    client.init()
    local_uri = main.as_uri().replace("file:///", "file://localhost/")
    client.send("textDocument/didOpen", {"textDocument": {"uri": local_uri,
        "languageId": "kalandra", "version": 1, "text": "fn main()->int:\n  missing\n"}})
    assert publications(client.barrier())[local_uri]["diagnostics"]
    client.send("textDocument/didClose", {"textDocument": {"uri": local_uri}})
    assert not publications(client.barrier())[local_uri]["diagnostics"]
    for uri in ("https://example.com/test.k", "file://remote/test.k", "file:///bad%00.k",
                "file:///bad%FF.k", "file:///bad%Z0.k", "file:///bad.k?query"):
        client.send("textDocument/didOpen", {"textDocument": {"uri": uri,
            "languageId": "kalandra", "version": 1, "text": good}})
        assert any(e.get("method") == "window/logMessage" for e in client.barrier())
    client.open(main, good)
    client.barrier()
    client.send("textDocument/didChange", {"textDocument": {"uri": main.as_uri(), "version": 2},
        "contentChanges": [{"text": "bad"}, {"text": good}]})
    assert not publications(client.barrier())[main.as_uri()]["diagnostics"]
    client.close(main)
    client.barrier()
    client.process.stdin.write(frame({"jsonrpc": "2.0", "id": 9.223372036854776e18,
                                     "method": "test/huge"}))
    client.process.stdin.flush()
    assert client.read()["error"]["code"] == -32600
    client.finish()

    # Parse-error recovery and bounded JSON nesting on a still-usable session.
    client = Client()
    for body in (b"{", b"[" * 129 + b"]" * 129):
        client.process.stdin.write(f"Content-Length: {len(body)}\r\n\r\n".encode() + body)
        client.process.stdin.flush()
        assert client.read()["error"]["code"] == -32700
    client.init()
    client.process.stdin.write(frame([]))
    client.process.stdin.flush()
    assert client.read()["error"]["code"] == -32600
    assert client.rpc("shutdown")["result"] is None
    assert client.rpc("unknown")["error"]["code"] == -32600
    client.send("exit")
    client.process.stdin.close()
    assert client.process.wait(timeout=10) == 0
    assert not client.process.stderr.read()

    # Hover reflects checked types, open-buffer changes and exact UTF-16 token ranges.
    source = "fn double(value:int):\n  value*2\nfn main():\n  number=21\n  double(number)\n"
    client = Client()
    client.init()
    client.open(main, source)
    result = client.hover(main, 0, 4)["result"]
    assert result["contents"] == {"kind": "plaintext", "value": "fn double(value: int64) -> int64"}
    assert result["range"] == {"start": {"line": 0, "character": 3}, "end": {"line": 0, "character": 9}}
    assert client.hover(main, 3, 3)["result"]["contents"]["value"] == "number: int64"
    assert client.hover(main, 4, 4)["result"]["contents"]["value"] == "fn double(value: int64) -> int64"
    assert client.hover(main, 1, 0)["result"] is None  # Whitespace.
    assert client.hover(main, 0, 0)["result"] is None  # Keyword.
    assert client.hover(main, 999, 0)["result"] is None
    assert client.hover(main, 0, -1)["error"]["code"] == -32602
    assert client.rpc("textDocument/hover", {})["error"]["code"] == -32602
    client.edits(main, [edit(3, 11, 11, ".5"), edit(0, 16, 19, "float")], 2)
    assert client.hover(main, 3, 3)["result"]["contents"]["value"] == "number: float64"
    assert client.hover(main, 4, 4)["result"]["contents"]["value"] == "fn double(value: float64) -> float64"
    client.change(main, "fn main():\n  unknown\n", 3)
    assert client.hover(main, 0, 4)["result"] is None  # No stale/partial typed IR.
    client.change(main, 'fn main()->String:\r\n  text="😀é"\r\n  text\r\n', 4)
    result = client.hover(main, 1, 10)["result"]  # Inside the string after the emoji.
    assert result["contents"]["value"] == "String"
    assert result["range"] == {"start": {"line": 1, "character": 7}, "end": {"line": 1, "character": 12}}
    assert client.hover(main, 1, 9)["result"] is None  # Inside surrogate pair.
    assert client.hover(main, 2, 3)["result"]["contents"]["value"] == "text: String"
    client.close(main)
    assert client.hover(main, 0, 3)["result"] is None
    client.finish()

    # Imported alias calls resolve to the compiler target, with current unsaved exports.
    lib.write_text("export fn scale(value:int):\n  value*2\n")
    caller = 'from "./lib.k" import scale as twice\nfn main():\n  twice(21)\n'
    client = Client()
    client.init(["markdown", "plaintext"])
    client.open(main, caller)
    hover = client.hover(main, 2, 3)["result"]
    assert hover["contents"] == {"kind": "markdown", "value": "```kalandra\nfn twice(value: int64) -> int64\n```"}
    client.open(lib, "export fn scale(value:float):\n  value*2\n")
    assert "float64" in client.hover(main, 2, 3)["result"]["contents"]["value"]
    client.edits(main, [edit(2, 10, 10, ".5")], 2)
    assert "float64" in client.hover(main, 2, 3)["result"]["contents"]["value"]
    client.close(lib)
    assert client.hover(main, 2, 3)["result"] is None
    client.finish()

    # Definition locations follow checked symbol identity and current source offsets.
    client = Client()
    client.init()
    source = "fn twice(value:int):\n  value*2\nfn main():\n  transform=twice\n  transform(21)\n"
    client.open(main, source)
    target = client.definition(main, 1, 3)["result"]
    assert target == {"uri": main.as_uri(), "range": {"start": {"line": 0, "character": 9},
                                                        "end": {"line": 0, "character": 14}}}
    assert client.definition(main, 3, 14)["result"]["range"]["start"] == {"line": 0, "character": 3}
    assert client.definition(main, 4, 4)["result"]["range"]["start"] == {"line": 3, "character": 2}
    client.change(main, 'fn main()->String:\r\n  text="é"\r\n  "😀" + text\r\n', 2)
    assert client.definition(main, 2, 10)["result"]["range"]["start"] == {"line": 1, "character": 2}
    assert client.definition(main, 2, 4)["result"] is None  # Inside the emoji's surrogate pair.
    assert client.definition(main, 1, 8)["result"] is None  # String literal.
    assert client.definition(main, 999, 0)["result"] is None
    assert client.definition(main, 0, -1)["error"]["code"] == -32602
    assert client.rpc("textDocument/definition", {})["error"]["code"] == -32602
    client.change(main, "fn main():\n  value=1\n  callback=fn(x:int):x+value\n  callback(2)\n", 3)
    assert client.definition(main, 2, 25)["result"]["range"]["start"] == {"line": 1, "character": 2}
    client.change(main, "fn main():\n  missing\n", 4)
    assert client.definition(main, 0, 4)["result"] is None
    client.close(main)
    assert client.definition(main, 0, 4)["result"] is None
    client.finish()

    # References distinguish lexical identities and honor declaration filtering.
    client = Client()
    client.init()
    source = "fn main()->int:\n  value=1\n  if true:\n    value=2\n    value\n  else:\n    value\n"
    client.open(main, source)
    refs = client.references(main, 1, 3)["result"]
    assert len(refs) == 1 and refs[0]["range"]["start"] == {"line": 6, "character": 4}
    refs = client.references(main, 1, 3, True)["result"]
    assert [r["range"]["start"]["line"] for r in refs] == [1, 6]
    assert client.references(main, 3, 5)["result"][0]["range"]["start"]["line"] == 4
    assert client.references(main, 0, 0)["result"] is None
    assert client.references(main, 999, 0)["result"] is None
    assert client.references(main, 0, -1)["error"]["code"] == -32602
    for context in ({}, {"includeDeclaration": 1}, {"includeDeclaration": "true"}):
        assert client.rpc("textDocument/references", {"textDocument": {"uri": main.as_uri()},
            "position": {"line": 1, "character": 3}, "context": context})["error"]["code"] == -32602
    client.change(main, 'fn main()->String:\r\n  text="é"\r\n  "😀" + text\r\n', 2)
    refs = client.references(main, 1, 3)["result"]
    assert refs == [{"uri": main.as_uri(), "range": {"start": {"line": 2, "character": 9},
                                                      "end": {"line": 2, "character": 13}}}]
    assert client.references(main, 2, 4)["result"] is None
    client.close(main)
    assert client.references(main, 0, 3)["result"] is None
    client.finish()

    # A same-spelled local function cannot steal a re-exported alias's destination.
    leaf = root / "deep space#é.k"
    original = "export fn scale(value:int):\n  value*2\n"
    leaf.write_text(original)
    facade = root / "public.k"
    facade.write_text('export from "./deep space#é.k" import scale as advertised\n')
    caller = ('from "./public.k" import advertised as twice\n'
              'fn scale(value:String):\n  value\nfn main():\n  twice(21)\n')
    client = Client()
    client.init()
    client.open(main, caller)
    target = client.definition(main, 4, 4)["result"]
    assert target == {"uri": leaf.as_uri(), "range": {"start": {"line": 0, "character": 10},
                                                        "end": {"line": 0, "character": 15}}}
    refs = client.references(main, 4, 4, True)["result"]
    assert {(r["uri"], r["range"]["start"]["line"]) for r in refs} == {(leaf.as_uri(), 0), (main.as_uri(), 4)}, refs
    other = root / "other.k"
    client.open(other, 'from "./public.k" import advertised\nfn main():\n  advertised(3)\n')
    refs = client.references(main, 4, 4)["result"]
    assert {r["uri"] for r in refs} == {main.as_uri(), other.as_uri()}
    assert len(refs) == 2  # Shared dependency occurrences are deduplicated.
    client.change(other, "fn main():\n  missing\n", 2)
    assert client.references(main, 4, 4)["error"]["code"] == -32803
    client.close(other)
    local_uri = leaf.as_uri().replace("file:///", "file://localhost/")
    client.send("textDocument/didOpen", {"textDocument": {"uri": local_uri,
        "languageId": "kalandra", "version": 1, "text": "\n\n" + original}})
    target = client.definition(main, 4, 4)["result"]
    assert target["uri"] == local_uri and target["range"]["start"]["line"] == 2
    client.send("textDocument/didChange", {"textDocument": {"uri": local_uri, "version": 2},
        "contentChanges": [edit(0, 0, 0, "# 😀\n")]})
    assert client.definition(main, 4, 4)["result"]["range"]["start"]["line"] == 3
    refs = client.references(main, 4, 4, True)["result"]
    assert len(refs) == 2
    assert any(r["uri"] == local_uri and r["range"]["start"]["line"] == 3 for r in refs)
    client.send("textDocument/didClose", {"textDocument": {"uri": local_uri}})
    target = client.definition(main, 4, 4)["result"]
    assert target["uri"] == leaf.as_uri() and target["range"]["start"]["line"] == 0
    refs = client.references(main, 4, 4, True)["result"]
    assert any(r["uri"] == leaf.as_uri() and r["range"]["start"]["line"] == 0 for r in refs)
    assert leaf.read_text() == original
    client.finish()

    # Explicit package mappings also retain the ultimate source declaration.
    manifest.write_text('format=1\n[project]\nentry="main.k"\n[packages]\nmath="public.k"\n')
    client = Client("--project", str(manifest))
    client.init()
    client.open(main, caller.replace('"./public.k"', '"math"'))
    assert client.definition(main, 4, 4)["result"]["uri"] == leaf.as_uri()
    assert len(client.references(main, 4, 4, True)["result"]) == 2
    client.finish()

    invalid_stream(b"Content-Length: 0\r\n\r\n")
    invalid_stream(b"Content-Length: 33554433\r\n\r\n")
    invalid_stream(b"Content-Length: 2\r\nContent-Length: 2\r\n\r\n{}")
    invalid_stream(b"Content-Length: nope\r\n\r\n")
    invalid_stream(b"X" * 8193)
    invalid_stream(b"Content-Length: 12\r\n\r\n{}")
    invalid_stream(b"Content-Length: 2\r\nContent-Type: application/vscode-jsonrpc; charset=latin1\r\n\r\n{}")
    invalid_stream(frame({"jsonrpc": "2.0", "method": "exit"}), 1)
    invalid_stream(b"", 1)
    invalid_stream(b"Content-Length: 2\r\n")

print("Native LSP: lifecycle, full sync, versions, dependency diagnostics, Unicode URIs/ranges, "
      "project mappings, source isolation, limits and malformed framing passed")
