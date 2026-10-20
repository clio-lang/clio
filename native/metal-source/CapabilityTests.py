"""Keep the public Metal capability matrix tied to valid executable source probes.

This is source admission and artifact validation, not new device conformance.
Existing numerical/runtime qualification is linked separately by each supported row.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile

SOURCE = Path(__file__).resolve().parent
REPO = SOURCE.parents[1]
MATRIX = SOURCE / "capabilities.json"
DOC = REPO / "docs/design/native-gpu-capabilities.md"
START, END = "<!-- capability-matrix:start -->", "<!-- capability-matrix:end -->"


def load():
    matrix = json.loads(MATRIX.read_text())
    assert matrix['format'] == 1
    ids, fixtures = set(), set()
    for row in matrix['rows']:
        assert re.fullmatch(r'[a-z][a-z0-9-]+', row['id']) and row['id'] not in ids
        ids.add(row['id'])
        assert row['scope'] in ('GPU', 'Host') and row['status'] in ('supported', 'rejected')
        assert row['fixtures']
        assert all('|' not in row[key] and '\n' not in row[key] for key in ('feature', 'notes'))
        for fixture in row['fixtures']:
            path = (SOURCE / fixture).resolve()
            assert path.is_relative_to(SOURCE) and path.suffix == '.k' and path.is_file()
            assert fixture not in fixtures, f'duplicate fixture: {fixture}'
            fixtures.add(fixture)
        if row['status'] == 'supported':
            assert row['evidence']
            for evidence in row['evidence']:
                path = (REPO / 'native/metal-proof/evidence' / evidence).resolve()
                assert path.is_relative_to(REPO / 'native/metal-proof/evidence') and path.is_file(), evidence
        else:
            assert row['diagnostic'].startswith('G')
    # Each dedicated negative probe must be part of the visible contract.
    assert {str(p.relative_to(SOURCE)) for p in (SOURCE / 'capabilities').glob('*.k')} <= fixtures
    return matrix


def table(matrix):
    lines = ['| Feature | Runs in | Status / boundary | Checks |',
             '| --- | --- | --- | --- |']
    for row in matrix['rows']:
        fixture = row['fixtures'][0]
        links = [f'[source](../../native/metal-source/{fixture})']
        if len(row['fixtures']) > 1:
            links[0] += f" (+{len(row['fixtures'])-1} additional probes)"
        links.extend(f'[device evidence](../../native/metal-proof/evidence/{proof})'
                     for proof in row.get('evidence', []))
        status = 'Supported' if row['status'] == 'supported' else 'Not admitted'
        lines.append(f"| {row['feature']} | {row['scope']} | **{status}.** {row['notes']} | {', '.join(links)} |")
    return '\n'.join(lines)


def run(args):
    result = subprocess.run(list(map(str, args)), capture_output=True, text=True, timeout=60)
    assert not any(s in result.stderr for s in ('ERROR: AddressSanitizer', 'runtime error:', 'WARNING: ThreadSanitizer')), result.stderr
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--compiler')
    parser.add_argument('--checker')
    parser.add_argument('--root')
    parser.add_argument('--write-docs', action='store_true')
    args = parser.parse_args()
    matrix = load()
    doc = DOC.read_text()
    before, tail = doc.split(START)
    _, after = tail.split(END)
    rendered = before + START + '\n\n' + table(matrix) + '\n\n' + END + after
    if args.write_docs:
        DOC.write_text(rendered)
        return
    assert doc == rendered, 'GPU capability table is stale; run CapabilityTests.py --write-docs'
    assert args.compiler and args.checker and args.root
    root = Path(args.root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    outcomes = []
    with tempfile.TemporaryDirectory(dir=root) as temporary:
        work = Path(temporary)
        for row in matrix['rows']:
            for index, fixture in enumerate(row['fixtures']):
                source = SOURCE / fixture
                # All probes must be valid under the current shared syntax, types
                # and placement rules; a malformed program is not a backend limit.
                typed = run([args.checker, '--placement', source])
                assert typed.returncode == 0, (fixture, typed.stdout, typed.stderr)
                destination = work / f"{row['id']}-{index}"
                if row['status'] == 'rejected':
                    destination.mkdir()
                    (destination / 'host.cpp').write_text('existing host sentinel')
                    (destination / 'kernel0.mlir').write_text('existing shader sentinel')
                    saved = {p.name: p.read_bytes() for p in destination.iterdir()}
                emitted = run([args.compiler, source, '-o', destination])
                if row['status'] == 'supported':
                    assert emitted.returncode == 0, (fixture, emitted.stdout, emitted.stderr)
                    for name in ('host.cpp', 'placement.ir', 'continuation.plan', 'manifest.txt'):
                        assert (destination / name).stat().st_size > 0, (fixture, name)
                    manifest = (destination / 'manifest.txt').read_text()
                    count = int(re.search(r'^kernel_count=(\d+)$', manifest, re.M)[1])
                    assert count > 0
                    shaders = sorted(p.name for p in destination.glob('kernel*.mlir')
                                     if re.fullmatch(r'kernel\d+\.mlir', p.name))
                    assert len(shaders) == count, (fixture, manifest, shaders)
                    for shader in shaders:
                        assert 'gpu.func' in (destination / shader).read_text(), (fixture, shader)
                    for entry, stage in re.findall(r'^(kernel\d+)\.reduction_stage=(kernel\d+-reduce)$', manifest, re.M):
                        assert (destination / (entry + '.mlir')).is_file()
                        assert 'gpu.func @kalandra_reduce_sum' in (destination / (stage + '.mlir')).read_text()
                        assert stage + '.metallib' in (destination / 'host.cpp').read_text()
                    for entry, stage in re.findall(r'^(kernel\d+)\.epilogue_stage=(kernel\d+-post)$', manifest, re.M):
                        assert (destination / (entry + '.mlir')).is_file()
                        assert re.search(r'gpu.func @kalandra_elementwise_v[23]', (destination / (stage + '.mlir')).read_text())
                        assert stage + '.metallib' in (destination / 'host.cpp').read_text()
                    outcomes.append({'fixture': fixture, 'status': 'supported', 'kernels': count})
                else:
                    assert emitted.returncode == 1, (fixture, emitted.stdout, emitted.stderr)
                    assert re.search(r'error\[' + row['diagnostic'] + r'\]', emitted.stderr), (fixture, emitted.stderr)
                    if 'message' in row:
                        assert row['message'] in emitted.stderr, (fixture, emitted.stderr)
                    assert saved == {p.name: p.read_bytes() for p in destination.iterdir()}, fixture
                    fresh = work / f"{row['id']}-{index}-fresh"
                    rejected = run([args.compiler, source, '-o', fresh])
                    assert rejected.returncode == 1 and not fresh.exists(), (fixture, rejected.stderr)
                    assert re.search(r'error\[' + row['diagnostic'] + r'\]', rejected.stderr)
                    if 'message' in row:
                        assert row['message'] in rejected.stderr, (fixture, rejected.stderr)
                    outcomes.append({'fixture': fixture, 'status': 'rejected', 'diagnostic': re.search(r'error\[(G\d+)\]', emitted.stderr)[1]})
    for outcome in outcomes:
        outcome['sourceSha256'] = hashlib.sha256((SOURCE / outcome['fixture']).read_bytes()).hexdigest()
    report = {'format': 1, 'matrixSha256': hashlib.sha256(MATRIX.read_bytes()).hexdigest(), 'outcomes': outcomes}
    (root / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f"Metal capability matrix: {len(matrix['rows'])} rows, {len(outcomes)} source probes passed")


if __name__ == '__main__':
    main()
