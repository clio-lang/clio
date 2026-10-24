"""Interleave pre-inlining/current checked calls with unbound and bound tokens."""
import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'fair'))
import protocol as p
import source_run as source

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--baseline-compiler', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    assert not args.output.exists()
    baseline = args.baseline_compiler.resolve()
    compiler = p.ROOT / 'build/native/native/kalandra'
    runtime = compiler.parent / 'libkalandra-task-core-optimized.a'
    directory = p.BUILD.parent / 'checked-inlining'
    directory.mkdir(exist_ok=True)
    original = Path(__file__).resolve().parent / 'fair/SourceDriver.cpp'
    text = original.read_text()
    text = re.sub(r'#include "([^"]+)"', lambda m: '#include "' +
                  str((original.parent / m[1]).resolve()) + '"', text)
    assert text.count('  for (int round = -2;') == 1
    assert text.count('kalandra::runtime::Invocation context;') == 1
    bound = '#include <atomic>\n' + text.replace('  for (int round = -2;',
        '  std::atomic<bool> cancellation{false};\n  for (int round = -2;')
    bound = bound.replace('kalandra::runtime::Invocation context;',
        'kalandra::runtime::Invocation context;\n      context.bindCancellation(&cancellation);')
    driver = directory / 'BoundDriver.cpp'
    driver.write_text(bound)
    inputs = [Path(__file__), original, driver, original.parent / 'source.k', baseline, compiler, runtime,
              *[p.ROOT / n for n in ('native/lib/Backend.cpp', 'native/lib/CheckedABI.cpp',
                'native/lib/NativeFastABI.h', 'native/lib/NativeTailCalls.h', 'native/lib/NativeStack.h',
                'native/runtime/Runtime.h', 'native/runtime/Runtime.cpp')]]
    frozen = {str(x): p.sha(x) for x in inputs}
    artifacts = []
    flags = ['-std=c++23', '-O2', '-ffp-contract=off', '-Wno-override-module', '-pthread', '-DKALANDRA_KERNEL']
    for version, executable in [('baseline', baseline), ('current', compiler)]:
        for name in source.NAMES:
            ir = directory / (version + '-' + name + '.ll')
            p.run([executable, original.parent / 'source.k', '--test-entry', name,
                   '--emit-llvm', ir, '-O2', '-o', ir.with_suffix('.standalone')])
            for mode in ('unbound', 'bound'):
                binary = directory / (version + '-' + name + '-' + mode)
                p.run([p.CLANG, *flags, driver if mode == 'bound' else original, ir, runtime, '-o', binary])
                artifacts.append(binary)
            artifacts.append(ir)
    def invoke(cell, count, rounds):
        version, name, mode = cell
        kind = source.NAMES.index(name)
        return p.observations(p.run([directory / (version + '-' + name + '-' + mode),
                                    kind, 14, count, rounds, 17]), source.expected(kind, 14), count, rounds)
    cells = [[version, name, mode] for version in ('baseline', 'current')
             for name in source.NAMES for mode in ('unbound', 'bound')]
    result = p.measure(cells, invoke, lambda c: source.expected(source.NAMES.index(c[1]), 14), rounds=5)
    result['baseline_compiler_sha256'] = p.sha(baseline)
    result['contract'] = ('Identical recursive source algorithms, optimized runtime archive, Clang flags and input '
        'depth 14/seed 17. Baseline/current and unbound/bound-token cells are interleaved across three fresh '
        'processes and five measured plus two warmup batches. Binding, invocation lifecycle, arithmetic '
        'checks, logical admission and cancellation acquire loads remain enabled. All checksums must match '
        'independent Fraction/integer/GCD references exactly. This isolates a compiler change; it is not '
        'a cross-language ranking or GPU benchmark.')
    assert all(p.sha(x) == h for x, h in frozen.items()), 'benchmark inputs changed'
    p.evidence(args.output, result, inputs + [original.parent / 'protocol.py', original.parent / 'source_run.py'],
               artifacts + [baseline, runtime], compiler)

if __name__ == '__main__':
    main()
