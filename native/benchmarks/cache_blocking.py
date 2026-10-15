#!/usr/bin/env python3
"""Evaluate strict C++ cache-layout prototypes beside generated CPU code and BLAS.

This is a direct, single-threaded research benchmark. It does not change compiler
lowering, and its C++/BLAS timing ratios are not compiler optimization speedups.
"""
import argparse
import datetime
import hashlib
import json
import pathlib
import platform
import re
import statistics
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
BUILD = ROOT / 'benchmarks/.build/cache-blocking'
VARIANTS = ('native', 'cpp-unblocked', 'cpp-k64', 'cpp-k256', 'cpp-k1024',
            'cpp-n16-unblocked', 'cpp-n16-k256', 'cpp-m4-n16-unblocked',
            'cpp-m4-n16-k64', 'cpp-m4-n16-k256', 'cpp-m4-n16-k1024', 'accelerate-single')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(output):
    rows = [json.loads(line) for line in output.splitlines()]
    descriptions = {(r['case'], r['variant']): r for r in rows if 'expected_bits' in r}
    assert len(descriptions) == 13 * len(VARIANTS)
    assert len(rows) == len(descriptions) * 8
    for (case, variant), description in descriptions.items():
        assert variant in VARIANTS
        samples = [r for r in rows if r['case'] == case and r['variant'] == variant and 'ms' in r]
        assert len(samples) == 7 and {r['round'] for r in samples} == set(range(7))
        assert all(r['ms'] > 0 for r in samples)
        expected = descriptions[case, 'native']['expected_bits']
        if variant != 'accelerate-single':
            assert description['expected_bits'] == expected
    return rows, descriptions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--compiler', type=pathlib.Path, default=ROOT / 'build/native/native/kalandrac')
    parser.add_argument('--output', type=pathlib.Path,
                        default=ROOT / f'benchmarks/results/native-cache-{datetime.date.today().isoformat()}.json')
    args = parser.parse_args()
    BUILD.mkdir(parents=True, exist_ok=True)
    lock = json.loads((ROOT / 'native/toolchain-proof/toolchain.json').read_text())
    clang = pathlib.Path(lock['defaultLlvmRoot']) / 'bin/clang++'
    sources = ('native/benchmarks/CacheBlocking.cpp', 'native/benchmarks/cache_blocking.py',
               'native/tests/fixtures/dynamic-projection.kalandra', 'native/runtime/Runtime.cpp',
               'native/runtime/Runtime.h', 'native/lib/Backend.cpp', 'native/lib/CheckedABI.cpp')
    hashes = {p: digest(ROOT / p) for p in sources}
    commands = []

    def run(command):
        command = list(map(str, command))
        commands.append(command)
        return subprocess.check_output(command, cwd=ROOT, text=True, timeout=180)

    def generate(name, extra):
        run([args.compiler.resolve(), ROOT / 'native/tests/fixtures/dynamic-projection.kalandra',
             '-o', BUILD / (name + '-projection'), '--emit-llvm', BUILD / (name + '.ll'),
             '--test-entry', 'reference', '-O2', *extra])

    flags = ['-std=c++23', '-Wall', '-Wextra', '-Werror', '-ffp-contract=off', '-Wno-override-module']
    source = ROOT / 'native/benchmarks/CacheBlocking.cpp'
    runtime = ROOT / 'native/runtime/Runtime.cpp'
    generate('current', [])
    run([clang, *flags, '-O2', '-DNDEBUG', source, BUILD / 'current.ll', runtime,
         '-framework', 'Accelerate', '-o', BUILD / 'timing'])
    run([clang, *flags, '-O2', '-DNDEBUG', '-S', source, '-o', BUILD / 'prototypes.s'])
    assembly = (BUILD / 'prototypes.s').read_text()
    assert not re.search(r'\b(?:fmadd|fmsub|fnmadd|fnmsub|fmla|fmls)\b', assembly)
    assert 'fmul.4s' in assembly and 'fadd.4s' in assembly
    print('Verifying strict block boundaries, per-cell IEEE cases, empty shapes and cancellation', flush=True)
    verification = {'normal': json.loads(run([BUILD / 'timing', '--verify']))}
    assert verification['normal']['verified_cases'] == 6468
    generate('sanitized', ['--sanitize'])
    sanitize = ['-O1', '-g', '-fsanitize=address,undefined', '-fno-sanitize-recover=all',
                '-fno-omit-frame-pointer']
    run([clang, *flags, *sanitize, source, BUILD / 'sanitized.ll', runtime,
         '-framework', 'Accelerate', '-o', BUILD / 'sanitized'])
    run([clang, *sanitize, '-ffp-contract=off', '-Wno-override-module', '-S', '-emit-llvm',
         BUILD / 'sanitized.ll', '-o', BUILD / 'instrumented.ll'])
    assert '__asan_report_load' in (BUILD / 'instrumented.ll').read_text()
    print('Verifying research kernels and generated code with ASan/UBSan', flush=True)
    verification['sanitized'] = json.loads(run([BUILD / 'sanitized', '--verify']))
    assert verification['normal'] == verification['sanitized']
    trials = []
    expected = None
    for trial in range(3):
        print(f'Cache layout trial {trial + 1}/3', flush=True)
        rows, descriptions = decode(run([BUILD / 'timing', '--seed', 20261015 + trial]))
        assert expected is None or expected == descriptions
        expected = descriptions
        trials.append(rows)
    summary = []
    for (case, variant), description in sorted(expected.items()):
        medians = [statistics.median(r['ms'] for r in trial
                                    if r['case'] == case and r['variant'] == variant and 'ms' in r)
                   for trial in trials]
        summary.append(dict(description, process_medians_ms=medians, median_ms=statistics.median(medians)))
    for row in summary:
        row['native_over_variant'] = next(r['median_ms'] for r in summary
                                          if r['case'] == row['case'] and r['variant'] == 'native') / row['median_ms']
        row['cpp_control_over_variant'] = next(r['median_ms'] for r in summary
                                               if r['case'] == row['case'] and r['variant'] == 'cpp-unblocked') / row['median_ms']
    cpu = {}
    for key in ('machdep.cpu.brand_string', 'hw.logicalcpu', 'hw.perflevel0.logicalcpu',
                'hw.perflevel1.logicalcpu', 'hw.memsize', 'hw.perflevel0.l1dcachesize',
                'hw.perflevel0.l2cachesize', 'hw.perflevel1.l1dcachesize', 'hw.perflevel1.l2cachesize'):
        try:
            cpu[key] = run(['sysctl', '-n', key]).strip()
        except subprocess.CalledProcessError:
            cpu[key] = 'unavailable'
    assert all(digest(ROOT / path) == h for path, h in hashes.items()), 'Sources changed during measurement'
    result = dict(schema_version=1, timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  platform=platform.platform(), cpu=cpu, commands=commands, source_sha256=hashes,
                  revision=run(['git', 'rev-parse', 'HEAD']).strip(),
                  worktree_status=run(['git', 'status', '--short']),
                  compiler_sha256=digest(args.compiler), llvm_sha256=digest(BUILD / 'current.ll'),
                  binary_sha256=digest(BUILD / 'timing'), clang=run([clang, '--version']).strip(),
                  blas_threading='BLASSetThreading(BLAS_THREADING_SINGLE_THREADED), queried back',
                  verification=verification, trials=trials, summary=summary)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(args.output)


if __name__ == '__main__':
    main()
