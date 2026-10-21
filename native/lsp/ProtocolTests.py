"""Independent stdlib-only, framed stdio tests for the native language server."""
import json
from pathlib import Path
from ProtocolClient import Client as BaseClient, frame, edit, apply_workspace_edit, publications
import subprocess
import sys
import tempfile

SERVER = sys.argv[1]
ROOT = Path(sys.argv[2])
ROOT.mkdir(parents=True, exist_ok=True)


class Client(BaseClient):
    def __init__(self, *args):
        super().__init__(SERVER, *args)


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

    # Nominal annotations, constructors and update labels use checked source identities.
    client = Client()
    client.init()
    types = ("type Point:\n  x:int\ntype Other:\n  x:int\n"
             "fn copy(point:Point)->Point:\n  point with {x:point.x+1}\n"
             "fn main()->Point:\n  value:Point=Point {x:2}\n  copy(value)\n")
    client.open(main, types)
    line = types.splitlines()[7]
    target = {"uri": main.as_uri(), "range": {"start": {"line": 0, "character": 5},
                                               "end": {"line": 0, "character": 10}}}
    for column in (line.index("Point"), line.rindex("Point")):
        assert client.definition(main, 7, column)["result"] == target
        assert client.hover(main, 7, column)["result"]["contents"]["value"] == "type Point"
    assert len(client.references(main, 7, line.index("Point"))["result"]) == 5
    assert len(client.references(main, 7, line.index("Point"), True)["result"]) == 6
    label = line.index("x:")
    field = client.definition(main, 7, label)["result"]
    assert field["range"]["start"] == {"line": 1, "character": 2}
    refs = client.references(main, 7, label)["result"]
    assert len(refs) == 3 and {r["range"]["start"]["line"] for r in refs} == {5, 7}
    assert client.hover(main, 7, label)["result"]["contents"]["value"] == "x: int64"
    assert client.definition(main, 1, 4)["result"] is None  # Builtin type has no source declaration.
    client.edits(main, [edit(0, 0, 0, "# 😀\r\n")], 2)
    assert client.definition(main, 8, label)["result"]["range"]["start"]["line"] == 2
    client.change(main, "type Point:\n  x:int\nfn main():\n  Point {bad:1}\n", 3)
    assert client.definition(main, 3, 3)["result"] is None
    client.finish()

    # Enum cases and shorthand pattern tokens retain both field and local roles.
    client = Client()
    client.init()
    enum = ("enum Signal:\n  Off\n  Sample:\n    value:int\n"
            "fn read(signal:Signal)->int:\n  match signal:\n"
            "    Signal.Sample {value}:value\n    Signal.Off:0\n"
            "fn main():\n  read(Signal.Sample {value:2})\n")
    client.open(main, enum)
    pattern = enum.splitlines()[6]
    case = pattern.index("Sample")
    label, use = pattern.index("value"), pattern.rindex("value")
    variant = client.definition(main, 6, case)["result"]
    assert variant["range"]["start"] == {"line": 2, "character": 2}
    assert client.hover(main, 6, case)["result"]["contents"]["value"] == "Sample: Signal"
    assert len(client.references(main, 6, case)["result"]) == 2
    assert len(client.references(main, 6, case, True)["result"]) == 3
    binding = client.definition(main, 6, use)["result"]
    assert binding["range"]["start"] == {"line": 6, "character": label}
    assert client.definition(main, 6, label)["result"] == binding
    assert len(client.references(main, 6, label)["result"]) == 1
    assert len(client.references(main, 3, 5)["result"]) == 2  # Field label includes shorthand.
    assert client.hover(main, 6, label)["result"]["contents"]["value"] == "value: int64"
    explicit = enum.replace("{value}:value", "{value:item}:item")
    client.change(main, explicit, 2)
    field = client.definition(main, 6, label)["result"]
    assert field["range"]["start"] == {"line": 3, "character": 4}
    assert client.definition(main, 6, label+6)["result"]["range"]["start"] == {"line": 6, "character": label+6}
    client.edits(main, [edit(0, 0, 0, "# 😀\r\n")], 3)
    assert client.definition(main, 7, case)["result"]["range"]["start"]["line"] == 3
    client.change(main, enum.replace("Signal.Off:0", "Signal.Unknown:0"), 4)
    assert client.definition(main, 6, case)["result"] is None
    client.finish()

    # Imported enum case and payload origins follow an unsaved library's source URI.
    enum_lib = root / "enum space#é.k"
    enum_text = "export enum Signal:\n  Off\n  Sample:\n    value:int\n"
    enum_lib.write_text(enum_text)
    enum_facade = root / "enum-public.k"
    enum_facade.write_text('export from "./enum space#é.k" import Signal as PublicSignal\n')
    enum_caller = ('from "./enum-public.k" import PublicSignal as S\nfn main()->int:\n'
                   '  match S.Sample {value:2}:\n    S.Sample {value:item}:item\n    _:0\n')
    client = Client()
    client.init()
    client.open(main, enum_caller)
    target = client.definition(main, 3, 6)["result"]
    assert target["uri"] == enum_lib.as_uri() and target["range"]["start"] == {"line": 2, "character": 2}
    assert len(client.references(main, 3, 6, True)["result"]) == 3
    assert client.definition(main, 4, 4)["result"] is None  # Wildcard.
    enum_uri = enum_lib.as_uri().replace("file:///", "file://localhost/")
    client.send("textDocument/didOpen", {"textDocument": {"uri": enum_uri,
        "languageId": "kalandra", "version": 1, "text": "# 😀\r\n"+enum_text}})
    target = client.definition(main, 3, 14)["result"]  # Explicit payload label.
    assert target["uri"] == enum_uri and target["range"]["start"] == {"line": 4, "character": 4}
    refs = client.references(main, 3, 6, True)["result"]
    assert any(r["uri"] == enum_uri and r["range"]["start"]["line"] == 3 for r in refs)
    client.send("textDocument/didClose", {"textDocument": {"uri": enum_uri}})
    assert client.definition(main, 3, 6)["result"]["range"]["start"]["line"] == 2
    assert enum_lib.read_text() == enum_text
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
    assert {(r["uri"], r["range"]["start"]["line"]) for r in refs} == {(leaf.as_uri(), 0), (main.as_uri(), 0), (main.as_uri(), 4), (facade.as_uri(), 0)}, refs
    assert len(refs) == 6  # Original declaration, two import spellings per alias, and call.
    assert client.definition(main, 0, caller.index("advertised"))["result"] == target
    assert client.definition(main, 0, caller.index("twice"))["result"] == target
    assert "fn twice(" in client.hover(main, 0, caller.index("twice"))["result"]["contents"]["value"]
    other = root / "other.k"
    client.open(other, 'from "./public.k" import advertised\nfn main():\n  advertised(3)\n')
    refs = client.references(main, 4, 4)["result"]
    assert {r["uri"] for r in refs} == {main.as_uri(), other.as_uri(), facade.as_uri()}
    assert len(refs) == 7  # Shared dependency occurrences are deduplicated.
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
    assert len(refs) == 6
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
    client.init(workspaceFolders=[])
    client.open(main, caller.replace('"./public.k"', '"math"'))
    assert client.definition(main, 4, 4)["result"]["uri"] == leaf.as_uri()
    assert len(client.references(main, 4, 4, True)["result"]) == 6
    client.finish()

    # Workspace discovery includes unopened importers, with fresh reads and buffer precedence.
    workspace = root / "workspace space#é"
    workspace.mkdir()
    (workspace / "nested").mkdir()
    ws_lib = workspace / "lib.k"
    ws_source = "export fn twice(value:int):\n  value*2\n"
    ws_lib.write_text(ws_source)
    first = workspace / "first.k"
    first_source = 'from "./lib.k" import twice\nfn main():\n  twice(1)\n'
    first.write_text(first_source)
    second = workspace / "nested" / "second.k"
    second.write_text(first_source.replace('"./lib.k"', '"../lib.k"'))
    sibling = root / "workspace-other"
    sibling.mkdir()
    broken = sibling / "bad.k"
    broken.write_text("fn main():\n  unknown\n")
    folders = [{"uri": workspace.as_uri(), "name": "project"},
               {"uri": sibling.as_uri(), "name": "other"}]
    client = Client()
    client.init(workspaceFolders=folders)
    client.open(ws_lib, ws_source)
    client.open(broken, broken.read_text())
    refs = client.references(ws_lib, 0, 11)["result"]
    assert len(refs) == 4 and {r["uri"] for r in refs} == {first.as_uri(), second.as_uri()}
    assert len(client.references(ws_lib, 0, 11, True)["result"]) == 5
    first.write_text("# disk edit\n"+first_source)
    refs = client.references(ws_lib, 0, 11)["result"]
    assert any(r["uri"] == first.as_uri() and r["range"]["start"]["line"] == 3 for r in refs)
    added = workspace / "added.k"
    added.write_text(first_source)
    assert len(client.references(ws_lib, 0, 11)["result"]) == 6
    added.unlink()
    assert len(client.references(ws_lib, 0, 11)["result"]) == 4
    first.write_text("fn main():\n  missing\n")
    first_uri = first.as_uri().replace("file:///", "file://localhost/")
    client.send("textDocument/didOpen", {"textDocument": {"uri": first_uri,
        "languageId": "kalandra", "version": 1, "text": first_source}})
    refs = client.references(ws_lib, 0, 11)["result"]
    assert len(refs) == 4 and any(r["uri"] == first_uri for r in refs)
    client.send("textDocument/didClose", {"textDocument": {"uri": first_uri}})
    assert client.references(ws_lib, 0, 11)["error"]["code"] == -32803
    first.write_text(first_source)
    client.change(ws_lib, "export fn twice(value:String):\n  value\n", 2)
    assert client.references(ws_lib, 0, 11)["error"]["code"] == -32803
    client.change(ws_lib, ws_source, 3)
    for excluded in (".git", ".hg", ".svn", "node_modules", "build", "dist", "target",
                     ".cache", ".svelte-kit", ".vercel"):
        directory = workspace / excluded
        directory.mkdir()
        (directory / "bad.k").write_text("fn main():\n  unknown\n")
    (workspace / "external-link").symlink_to(sibling, target_is_directory=True)
    (workspace / "file-link.k").symlink_to(broken)
    assert len(client.references(ws_lib, 0, 11)["result"]) == 4
    client.finish()

    # rootUri fallback and workspaceFolders precedence; no dynamic folder changes advertised.
    client = Client()
    client.init(rootUri=workspace.as_uri())
    client.open(ws_lib, ws_source)
    assert len(client.references(ws_lib, 0, 11)["result"]) == 4
    client.finish()
    client = Client()
    client.init(workspaceFolders=folders, rootUri="invalid ignored root")
    client.open(ws_lib, ws_source)
    assert len(client.references(ws_lib, 0, 11)["result"]) == 4
    outside = root / "standalone.k"
    standalone = "fn only()->int:\n  1\nfn main():\n  only()\n"
    client.open(outside, standalone)
    assert len(client.references(outside, 0, 4)["result"]) == 1  # Outside configured roots: own graph only.
    client.finish()

    # An explicitly nested workspace isolates its query from the containing project's errors.
    nested_workspace = workspace / "island"
    nested_workspace.mkdir()
    island_lib = nested_workspace / "lib.k"
    island_lib.write_text(ws_source)
    (nested_workspace / "caller.k").write_text(first_source)
    outer_bad = workspace / "bad.k"
    outer_bad.write_text("fn main():\n  missing\n")
    client = Client()
    client.init(workspaceFolders=[folders[0], {"uri": nested_workspace.as_uri(), "name": "nested"}])
    client.open(island_lib, ws_source)
    assert len(client.references(island_lib, 0, 11)["result"]) == 2
    client.finish()
    outer_bad.unlink()

    # Explicit manifest-directory discovery supplies package mappings to unopened roots.
    project_dir = root / "discovered-project"
    project_dir.mkdir()
    project_lib = project_dir / "lib.k"
    project_lib.write_text(ws_source)
    package_caller = first_source.replace('"./lib.k"', '"math"')
    (project_dir / "main.k").write_text(package_caller)
    (project_dir / "unopened.k").write_text(package_caller)
    project_manifest = project_dir / "kalandra.toml"
    project_manifest.write_text('format=1\n[project]\nentry="main.k"\n[packages]\nmath="lib.k"\n')
    client = Client("--project", str(project_manifest))
    client.init()
    client.open(project_lib, ws_source)
    assert len(client.references(project_lib, 0, 11)["result"]) == 4
    client.finish()
    client = Client("--project", str(project_manifest))
    client.init(workspaceFolders=[])
    client.open(project_lib, ws_source)
    assert len(client.references(project_lib, 0, 11)["result"]) == 2  # Explicit opt-out, project entry retained.
    client.finish()

    # Explicit imports may reach external packages; discovery does not crawl their directories.
    external_package = root / "external-package.k"
    external_package.write_text(ws_source)
    project_manifest.write_text('format=1\n[project]\nentry="main.k"\n[packages]\nmath="../external-package.k"\n')
    client = Client("--project", str(project_manifest))
    client.init()
    client.open(project_dir / "main.k", package_caller)
    refs = client.references(project_dir / "main.k", 2, 3, True)["result"]
    assert len(refs) == 5 and any(r["uri"] == external_package.as_uri() for r in refs)
    assert all(r["uri"] != project_lib.as_uri() for r in refs)  # Same spelling, distinct declaration.
    client.finish()

    # Initialization validates roots transactionally and permits a corrected initialize request.
    for params in ({"workspaceFolders": {}}, {"workspaceFolders": [{"uri": broken.as_uri()}]},
                   {"rootUri": "https://example.com/"}, {"rootUri": (root/"missing").as_uri()},
                   {"workspaceFolders": [folders[0]]*17}):
        client = Client()
        assert client.rpc("initialize", {"capabilities": {}, **params})["error"]["code"] == -32602
        client.init(workspaceFolders=[])
        client.finish()

    # Discovery budgets fail explicitly before yielding a partial array, and recover next request.
    limited = root / "limited-workspace"
    limited.mkdir()
    limited_lib = limited / "lib.k"
    limited_lib.write_text(ws_source)
    for number in range(512):
        (limited / f"{number}.k").write_text("")
    client = Client()
    client.init(rootUri=limited.as_uri())
    client.open(limited_lib, ws_source)
    response = client.references(limited_lib, 0, 11)
    assert response["error"]["code"] == -32803 and "source-file budget" in response["error"]["message"]
    for number in range(512):
        (limited / f"{number}.k").unlink()
    assert client.references(limited_lib, 0, 11)["result"] == []
    client.finish()

    # Versioned rename proposals preserve Unicode/CRLF and never write buffers or files.
    rename_root = root / "rename-unicode"
    rename_root.mkdir()
    rename_file = rename_root / "main.k"
    disk = "fn main():\n  0\n"
    rename_file.write_text(disk)
    rename_text = '# 😀\r\nfn main()->String:\r\n  value="é"\r\n  "😀" + value\r\n'
    rename_uri = rename_file.as_uri().replace("file:///", "file://localhost/")
    client = Client()
    client.init(rename=True, rootUri=rename_root.as_uri())
    client.send("textDocument/didOpen", {"textDocument": {"uri": rename_uri,
        "languageId": "kalandra", "version": 7, "text": rename_text}})
    prepared = client.prepare_rename(rename_uri, 3, 10)["result"]
    assert prepared == {"placeholder": "value", "range": {"start": {"line": 3, "character": 9},
                                                           "end": {"line": 3, "character": 14}}}
    change = client.rename(rename_uri, 3, 10, "textValue")["result"]
    assert len(change["documentChanges"]) == 1
    assert change["documentChanges"][0]["textDocument"] == {"uri": rename_uri, "version": 7}
    assert len(change["documentChanges"][0]["edits"]) == 2
    applied = apply_workspace_edit(change, {rename_uri: rename_text})[rename_uri]
    assert applied == rename_text.replace("value", "textValue")
    assert rename_file.read_text() == disk
    assert client.prepare_rename(rename_uri, 3, 10)["result"] == prepared  # Proposal did not mutate state.
    assert client.rename(rename_uri, 3, 10, "value")["result"] == {"documentChanges": []}
    for invalid in ("", "fn", "String", "float32", "_", "main", "é", "a b", "9name"):
        assert client.rename(rename_uri, 3, 10, invalid)["error"]["code"] == -32602
    assert client.prepare_rename(rename_uri, 1, 4)["result"] is None  # main entry.
    assert client.prepare_rename(rename_uri, 1, 0)["result"] is None  # keyword.
    assert client.prepare_rename(rename_uri, 3, 4)["result"] is None  # split surrogate.
    assert client.rename(rename_uri, 999, 0, "other")["result"] is None
    assert client.rename(rename_uri, 0, -1, "other")["error"]["code"] == -32602
    client.send("textDocument/didChange", {"textDocument": {"uri": rename_uri, "version": 8},
        "contentChanges": [{"text": applied}]})
    assert client.prepare_rename(rename_uri, 3, 10)["result"]["placeholder"] == "textValue"
    client.finish()

    # No unversioned edit fallback and no implicit workspace for rename.
    client = Client()
    client.init(rootUri=rename_root.as_uri())
    client.open(rename_file, rename_text)
    assert client.rename(rename_file, 2, 3, "other")["error"]["code"] == -32803
    client.finish()
    client = Client()
    client.init(rename=True)
    client.open(rename_file, rename_text)
    assert client.rename(rename_file, 2, 3, "other")["error"]["code"] == -32803
    client.finish()
    client = Client()
    caps = client.rpc("initialize", {"rootUri": rename_root.as_uri(), "capabilities": {
        "workspace": {"workspaceEdit": {"documentChanges": True}}}})["result"]["capabilities"]
    assert caps["renameProvider"] is True  # No options object without prepareSupport.
    client.send("initialized", {})
    client.open(rename_file, rename_text)
    assert client.rename(rename_file, 2, 3, "other")["result"]["documentChanges"]
    client.finish()

    # Original export rename stops at explicit aliases, including identical spelling aliases.
    alias_root = root / "rename-aliases"
    alias_root.mkdir()
    alias_sources = {
        "lib.k": "export fn scale(value:int):\n  value*2\n",
        "facade.k": 'export from "./lib.k" import scale as publicScale\n',
        "relay.k": 'export from "./facade.k" import publicScale\n',
        "main.k": 'from "./relay.k" import publicScale as localScale\nfn main():\n  localScale(2)\n',
        "unopened.k": 'from "./lib.k" import scale\nfn main():\n  scale(2)\n',
        "same.k": 'from "./lib.k" import scale as scale\nfn main():\n  scale(2)\n'}
    for file, text in alias_sources.items():
        (alias_root/file).write_text(text)
    alias_uris = {(alias_root/file).as_uri(): text for file, text in alias_sources.items()}
    client = Client()
    client.init(rename=True, rootUri=alias_root.as_uri())
    client.open(alias_root/"lib.k", alias_sources["lib.k"], 4)
    change = client.rename(alias_root/"lib.k", 0, 11, "amplify")["result"]
    assert {entry["textDocument"]["uri"] for entry in change["documentChanges"]} == {
        (alias_root/file).as_uri() for file in ("lib.k", "facade.k", "unopened.k", "same.k")}
    for entry in change["documentChanges"]:
        assert entry["textDocument"]["version"] == (4 if entry["textDocument"]["uri"] == (alias_root/"lib.k").as_uri() else None)
    applied = apply_workspace_edit(change, alias_uris)
    assert 'import amplify as scale' in applied[(alias_root/"same.k").as_uri()]
    assert '  scale(2)' in applied[(alias_root/"same.k").as_uri()]
    assert applied[(alias_root/"main.k").as_uri()] == alias_sources["main.k"]
    assert '  amplify(2)' in applied[(alias_root/"unopened.k").as_uri()]
    client.open(alias_root/"facade.k", alias_sources["facade.k"])
    at = alias_sources["facade.k"].index("publicScale")
    change = client.rename(alias_root/"facade.k", 0, at, "published")["result"]
    applied = apply_workspace_edit(change, alias_uris)
    assert 'import published' in applied[(alias_root/"relay.k").as_uri()]
    assert 'published as localScale' in applied[(alias_root/"main.k").as_uri()]
    assert applied[(alias_root/"lib.k").as_uri()] == alias_sources["lib.k"]
    client.open(alias_root/"main.k", alias_sources["main.k"], 2)
    change = client.rename(alias_root/"main.k", 2, 3, "transform")["result"]
    assert len(change["documentChanges"]) == 1 and change["documentChanges"][0]["textDocument"]["version"] == 2
    applied = apply_workspace_edit(change, alias_uris)
    assert 'publicScale as transform' in applied[(alias_root/"main.k").as_uri()]
    assert '  transform(2)' in applied[(alias_root/"main.k").as_uri()]
    for file, text in alias_sources.items():
        assert (alias_root/file).read_text() == text
    client.finish()

    # Shorthand field rename and local rename expand opposite roles.
    pattern_root = root / "rename-patterns"
    pattern_root.mkdir()
    pattern_file = pattern_root / "main.k"
    pattern_source = ('enum Box:\n  Some:\n    value:int\nfn read(box:Box)->int:\n'
                      '  match box:\n    Box.Some {value}:value\nfn main():\n  read(Box.Some {value:2})\n')
    pattern_file.write_text(pattern_source)
    client = Client()
    client.init(rename=True, rootUri=pattern_root.as_uri())
    client.open(pattern_file, pattern_source)
    change = client.rename(pattern_file, 2, 5, "amount")["result"]
    applied = apply_workspace_edit(change, {pattern_file.as_uri(): pattern_source})[pattern_file.as_uri()]
    assert '{amount:value}:value' in applied and '{amount:2}' in applied
    at = pattern_source.splitlines()[5].index("value")
    change = client.rename(pattern_file, 5, at, "amount")["result"]
    applied = apply_workspace_edit(change, {pattern_file.as_uri(): pattern_source})[pattern_file.as_uri()]
    assert '{value:amount}:amount' in applied and '{value:2}' in applied
    client.finish()

    # A compiling rename that captures another binding is rejected without changing the buffer.
    capture_root = root / "rename-capture"
    capture_root.mkdir()
    capture_file = capture_root/"main.k"
    capture_source = "fn main():\n  value=1\n  read=fn(other:int):value+other\n  read(2)\n"
    capture_file.write_text(capture_source)
    client = Client()
    client.init(rename=True, rootUri=capture_root.as_uri())
    client.open(capture_file, capture_source)
    response = client.rename(capture_file, 1, 3, "other")
    assert response["error"]["code"] == -32803 and "resolution" in response["error"]["message"]
    assert client.prepare_rename(capture_file, 1, 3)["result"]["placeholder"] == "value"
    assert capture_file.read_text() == capture_source
    client.finish()

    # Completion probes unsaved buffers, returns plain UTF-16 edits, and leaves
    # diagnostics and source buffers alone. Dependencies use the same overlays.
    completion_root = Path(temp) / "completion"
    completion_root.mkdir()
    library = completion_root / "library.k"
    library.write_text("export fn hidden(value:int):\n  value\n")
    document = completion_root / "main.k"
    client = Client()
    client.init()
    text = ('from "./library.k" import hidden as publicName\n'
            'fn main():\n  earlier = 1\n  pubSuffix\n')
    client.open(document, text)
    client.barrier()
    result = client.completion(document, 3, 5)["result"]
    assert not result["isIncomplete"]
    assert [item["label"] for item in result["items"]] == ["publicName"], result
    item = result["items"][0]
    assert item["kind"] == 3 and item["insertTextFormat"] == 1
    assert item["textEdit"] == {"newText": "publicName", "range": {
        "start": {"line": 3, "character": 2}, "end": {"line": 3, "character": 11}}}, item
    assert not document.exists(), "completion wrote the unsaved document"
    assert not client.barrier(), "completion published probe diagnostics"
    client.open(library, "export fn changed(value:int):\n  value\n")
    client.barrier()
    assert client.completion(document, 3, 5)["result"]["items"] == [], "stale import suggestions"
    client.close(library)
    client.barrier()
    assert client.completion(document, 3, 5)["result"]["items"][0]["label"] == "publicName"
    # Astral Unicode before a cursor must not shift the UTF-16 replacement edit.
    # Use a preceding String argument instead of an unsupported statement separator.
    text = 'fn join(text:String, value:int):\n  value\nfn main():\n  earlier = 2\n  join("😀", earSuffix)\n'
    client.change(document, text, 2)
    client.barrier()
    result = client.completion(document, 4, 16)["result"]
    assert [item["label"] for item in result["items"]] == ["earlier"], result
    assert result["items"][0]["textEdit"]["range"] == {
        "start": {"line": 4, "character": 13}, "end": {"line": 4, "character": 22}}
    assert client.completion(document, 4, 9)["result"] is None, "surrogate split"
    assert client.completion(document, 300, 0)["result"] is None
    assert client.rpc("textDocument/completion", {"textDocument": {"uri": document.as_uri()},
        "position": {"line": -1, "character": 0}})["error"]["code"] == -32602
    # Record fields use current imported declarations and UTF-16 member edits.
    library.write_text("export type Box:\n  value:int\n")
    text = ('from "./library.k" import Box\n'
            'fn join(text:String, value:int):\n  value\n'
            'fn main():\n  box=Box {value:1}\n  join("😀", box.vaSuffix)\n')
    client.change(document, text, 3)
    client.barrier()
    member_line = text.splitlines()[5]
    start = len(member_line[:member_line.index("vaSuffix")].encode("utf-16-le")) // 2
    result = client.completion(document, 5, start + 2)["result"]
    assert [item["label"] for item in result["items"]] == ["value"], result
    field = result["items"][0]
    assert field["kind"] == 5 and field["detail"] == "record field", field
    assert field["textEdit"] == {"newText": "value", "range": {
        "start": {"line": 5, "character": start},
        "end": {"line": 5, "character": start + len("vaSuffix")}}}, field
    assert not client.barrier(), "member probe leaked diagnostics"
    client.open(library, "export type Box:\n  changed:int\n")
    client.barrier()
    assert client.completion(document, 5, start + 2)["result"]["items"] == [], "stale member declaration"
    client.change(document, text.replace("{value:1}", "{changed:1}").replace("vaSuffix", "chSuffix"), 4)
    client.barrier()
    assert [item["label"] for item in client.completion(document, 5, start + 2)["result"]["items"]] == ["changed"]
    client.close(library)
    client.barrier()
    # Enum constructors and match patterns use the same current nominal declaration.
    library.write_text("export enum Choice:\n  Some:\n    value:int\n  Other\n")
    text = ('from "./library.k" import Choice as Pick\n'
            'fn main():\n  Pick.SoSuffix {value:1}\n')
    client.change(document, text, 5)
    client.barrier()
    result = client.completion(document, 2, 9)["result"]
    assert [item["label"] for item in result["items"]] == ["Some"], result
    case = result["items"][0]
    assert case["kind"] == 20 and case["detail"] == "enum case", case
    assert case["textEdit"] == {"newText": "Some", "range": {
        "start": {"line": 2, "character": 7}, "end": {"line": 2, "character": 15}}}, case
    assert not client.barrier(), "enum probe leaked diagnostics"
    text = ('from "./library.k" import Choice as Pick\n'
            'fn inspect(c:Pick):\n  match c:\n    Pick.Other: 0\n    Pick.: 1\n'
            'fn main():\n  0\n')
    client.change(document, text, 6)
    client.barrier()
    assert [item["label"] for item in client.completion(document, 4, 9)["result"]["items"]] == ["Some"]
    client.open(library, "export enum Choice:\n  Changed\n  Other\n")
    client.barrier()
    assert [item["label"] for item in client.completion(document, 4, 9)["result"]["items"]] == ["Changed"]
    client.close(library)
    client.barrier()
    # Named construction labels add a colon only when absent, without dummy values.
    library.write_text("export type Box:\n  value:int\n  other:int\n")
    text = ('from "./library.k" import Box\n'
            'fn join(text:String,value:Box):\n  value\n'
            'fn main():\n  join("😀", Box { vaSuffix, other:2 })\n')
    client.change(document, text, 7)
    client.barrier()
    line = text.splitlines()[4]
    start = len(line[:line.index("vaSuffix")].encode("utf-16-le")) // 2
    result = client.completion(document, 4, start + 2)["result"]
    assert [item["label"] for item in result["items"]] == ["value"], result
    field = result["items"][0]
    assert field["kind"] == 5 and field["insertTextFormat"] == 1
    assert field["textEdit"] == {"newText": "value: ", "range": {
        "start": {"line": 4, "character": start},
        "end": {"line": 4, "character": start + 8}}}, field
    assert not document.exists(), "label completion wrote source"
    assert not client.barrier(), "label probe published diagnostics"
    client.change(document, text.replace("vaSuffix", "vaSuffix:1"), 8)
    client.barrier()
    assert client.completion(document, 4, start + 2)["result"]["items"][0]["textEdit"]["newText"] == "value"
    client.open(library, "export type Box:\n  variable:int\n  other:int\n")
    client.barrier()
    assert [item["label"] for item in client.completion(document, 4, start + 2)["result"]["items"]] == ["variable"]
    client.close(library)
    client.barrier()
    client.close(document)
    client.barrier()
    assert client.completion(document, 4, 16)["result"] is None
    client.finish()

    # Format the current buffer only; the client independently applies the edit.
    formatter = Path(temp) / "format.k"
    disk = b"fn main():\n  99\n"
    formatter.write_bytes(disk)
    client = Client()
    client.init()
    text = '# 👩\r\nfn main( ):\r\n    "😀"'
    expected = '# 👩\nfn main():\n  "😀"\n'
    client.open(formatter, text)
    client.barrier()
    edits = client.formatting(formatter)["result"]
    assert edits == [{"range": {"start": {"line": 0, "character": 0},
        "end": {"line": 2, "character": 8}}, "newText": expected}], edits
    applied = apply_workspace_edit({"documentChanges": [{"textDocument": {"uri": formatter.as_uri()},
        "edits": edits}]}, {formatter.as_uri(): text})[formatter.as_uri()]
    assert applied == expected
    assert client.formatting(formatter, {"tabSize": 8, "insertSpaces": False})["result"] == edits
    assert not client.barrier(), "formatting published diagnostics or changed buffers"
    assert formatter.read_bytes() == disk
    client.change(formatter, applied, 2)
    client.barrier()
    assert client.formatting(formatter)["result"] == [], "formatter not idempotent"
    client.change(formatter, 'fn main(\n', 3)
    client.barrier()
    assert client.formatting(formatter)["result"] == [], "invalid source offered edits"
    # Formatting is syntax-only; imports need not be available to format a file.
    client.change(formatter, 'from "./missing.k" import helper\nfn main():\n    helper( 1 )\n', 4)
    client.barrier()
    edits = client.formatting(formatter)["result"]
    assert len(edits) == 1 and edits[0]["newText"].endswith('  helper(1)\n')
    client.change(formatter, 'fn main():\n  devices . gpu(1)\n', 5)
    client.barrier()
    assert client.formatting(formatter)["error"]["code"] == -32803, "verification refusal lost"
    client.change(formatter, '', 6)
    client.barrier()
    assert client.formatting(formatter)["result"] == []
    for options in ({}, {"tabSize": 0, "insertSpaces": True},
                    {"tabSize": True, "insertSpaces": True}, {"tabSize": 2}):
        assert client.formatting(formatter, options)["error"]["code"] == -32602
    client.close(formatter)
    client.barrier()
    assert client.formatting(formatter)["result"] == []
    assert formatter.read_bytes() == disk
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
