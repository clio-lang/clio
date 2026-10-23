"""Execute the native CPU language/runtime contract on Linux and Windows."""
import argparse
import json
import os
from pathlib import Path
import platform
import subprocess
import tempfile


def qualify(compiler):
    compiler = compiler.resolve()
    windows = platform.system() == "Windows"
    modes = [("normal", []), ("optimized", ["-O2"]), ("address-undefined", ["--sanitize"])]
    if not windows:
        modes.append(("thread", ["--thread-sanitize"]))
    with tempfile.TemporaryDirectory(prefix="kalandra portable acceptance ") as folder:
        work = Path(folder)
        source = work / "source λ.k"
        executable = work / ("program.exe" if windows else "program")

        def run(args, expected=0, env=None):
            result = subprocess.run(list(map(str, args)), cwd=work, capture_output=True,
                                    text=True, encoding="utf-8", timeout=120, env=env)
            assert result.returncode == expected, (args, result.returncode, result.stdout, result.stderr)
            return result

        cases = []
        values = {"int8": "127", "uint8": "255", "int16": "32767", "uint16": "65535",
                  "int32": "2147483647", "uint32": "4294967295",
                  "int64": "9223372036854775807", "uint64": "18446744073709551615",
                  "float32": "1.5", "float64": "1.5"}
        for numeric, value in values.items():
            cases += [(f"{numeric} scalar", f"fn main()->{numeric}:\n  {value}\n", value),
                      (f"{numeric} array", f"fn main()->[{numeric}]:\n  [{value},0]\n", f"[{value}, 0]"),
                      (f"{numeric} tensor", f"fn main()->Tensor[{numeric},2,2]:\n  tensor([[1,2],[3,4]])*2\n",
                       "tensor([2, 4, 6, 8], [2, 2])"),
                      (f"{numeric} worker", f"fn echo(value:{numeric})->{numeric}:\n  value\n"
                       f"fn main()->{numeric} ! TaskError:\n  try parallel:\n"
                       f"    work=spawn echo({value})\n    first=try await work\n    again=try await work\n"
                       "    if first==again:again\n    else:0\n", value)]
        cases += [("Bool", "fn main()->Bool:\n  true\n", "true"),
                  ("String", 'fn main()->String:\n  "é"+"🙂"\n', "é🙂"),
                  ("String array", 'fn main()->[String]:\n  ["é"+"🙂","retained"]\n', '["é🙂", "retained"]'),
                  ("record/enum ownership", """type Row:
  tag:uint8
  amount:uint64
  text:String
  values:[int]
enum Reading:
  Missing
  Value:
    item:Row
fn echo(value:Reading)->Reading:
  value
fn main()->int ! TaskError:
  try parallel:
    original=Reading.Value {item:Row {tag:255,amount:41,text:"é"+"🙂",values:[7,8]}}
    work=spawn echo(original)
    first=try await work
    again=try await work
    match again:
      Reading.Missing:0
      Reading.Value {item}:int(item.tag)+int(item.amount)+length(item.text)+item.values[0]
""", "305"),
                  ("expected-error channel", """error ReadError:
  Bad:
    text:String
fn read()->int ! ReadError:
  fail ReadError.Bad {text:"é"+"🙂"}
fn work()->int:
  read() catch fn(error):
    match error:
      ReadError.Bad {text}:length(text)+40
fn main()->int ! TaskError:
  try parallel:
    result=spawn work()
    try await result
""", "42")]
        compiled = 0
        for mode, flags in modes:
            for name, text, expected in cases:
                source.write_text(text, encoding="utf-8")
                run([compiler, source, "-o", executable, *flags])
                for workers in (1, 2, 4):
                    result = run([executable], env=dict(os.environ, KALANDRA_WORKERS=str(workers)))
                    assert result.stdout.strip() == expected, (mode, name, workers, result.stdout, expected)
                compiled += 1
            print(f"Portable CPU {platform.system()} {mode}: {len(cases)} programs, workers 1/2/4 passed", flush=True)
        project = work / "starter project λ"
        run([compiler, "new", project])
        run([compiler, "--project", project / "kalandra.toml", "-o", executable])
        assert run([executable]).stdout.strip() == "[2, 4, 6]"
        print(json.dumps({"platform": platform.platform(), "programsCompiled": compiled + 1,
                          "numericTypes": list(values), "modes": [name for name, _ in modes],
                          "workerCounts": [1, 2, 4], "starter": "passed"}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compiler", type=Path, required=True)
    qualify(parser.parse_args().compiler)
