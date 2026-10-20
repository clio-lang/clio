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

    def init(self):
        result = self.rpc("initialize", {"capabilities": {}})["result"]
        caps = result["capabilities"]
        assert caps["positionEncoding"] == "utf-16"
        assert caps["textDocumentSync"]["change"] == 1  # Full buffer, not incremental.
        assert not caps.get("completionProvider")
        self.send("initialized", {})

    def open(self, path, text, version=1):
        self.send("textDocument/didOpen", {"textDocument": {
            "uri": path.as_uri(), "languageId": "kalandra", "version": version, "text": text}})

    def change(self, path, text, version):
        self.send("textDocument/didChange", {"textDocument": {
            "uri": path.as_uri(), "version": version}, "contentChanges": [{"text": text}]})

    def close(self, path):
        self.send("textDocument/didClose", {"textDocument": {"uri": path.as_uri()}})

    def finish(self):
        assert self.rpc("shutdown")["result"] is None
        self.send("exit")
        self.process.stdin.close()
        assert self.process.wait(timeout=10) == 0
        assert self.process.stdout.read() == b"", "unexpected trailing protocol data"
        assert self.process.stderr.read() == b"", "unexpected server diagnostics/sanitizer output"


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
                                      "end": {"line": 0, "character": 1}}, "text": "bad"}]})
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
    client.change(lib, 'export fn value()->String:\n  "text"\n', 2)
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
