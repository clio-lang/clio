#!/usr/bin/env python3
"""Compare verified native numerical kernels with Go, Python, Rust and C++."""
import argparse
import datetime
import functools
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import random
import re
import shutil
import statistics
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(__file__).resolve().parent
CASES = ('dot', 'axpy', 'matrix')
LANGUAGES = ('kalandra', 'kalandra_gpu_resident', 'kalandra_gpu_transfers', 'cpp', 'go', 'rust', 'python')
WORKLOADS = [(kind, size) for kind in (0, 1) for size in (16384, 262144)] + [(2, 48), (2, 96)]
EDGES = [(kind, size) for kind in range(3) for size in (1, 3, 17)]


def run(command, env=None):
    result = subprocess.run([str(x) for x in command], cwd=ROOT, env=env,
                            text=True, capture_output=True, timeout=240)
    if result.returncode:
        raise RuntimeError(f"Command failed: {command}\n{result.stdout}\n{result.stderr}")
    return result.stdout


def executable(name, explicit=None, fallback=None):
    found = str(explicit) if explicit else shutil.which(name)
    if not found and fallback and fallback.is_file():
        found = str(fallback)
    if not found or not Path(found).is_file():
        raise ValueError(f'{name} not found; set its command-line option (no tools are auto-installed)')
    return Path(found).absolute()


@functools.cache
def expected(kind, n):
    """Independent exact integer reference; all inputs are small dyadic fractions."""
    count = n * n if kind == 2 else n
    a = [i % 17 - 8 for i in range(count)]
    b = [i % 13 - 6 for i in range(count)]
    if kind == 0:
        return sum(x * y for x, y in zip(a, b)) / 64
    if kind == 1:
        return sum(3 * x + y for x, y in zip(a, b)) / 8
    # Distribute the exact integer checksum over K; O(n^2), independent of GPU cell arithmetic.
    return sum(sum(a[row * n + k] for row in range(n)) * sum(b[k * n + col] for col in range(n))
               for k in range(n)) / 64


def validate(text, kind, n, iterations, rounds):
    observations = [json.loads(line) for line in text.splitlines()]
    if [row['round'] for row in observations] != list(range(-2, rounds)):
        raise ValueError('Missing, duplicate or reordered warmup/measurement rounds')
    reference = expected(kind, n) * iterations
    for row in observations:
        if row['checksum'] != reference or not math.isfinite(row['checksum']):
            raise ValueError(f'{CASES[kind]}({n}) checksum {row["checksum"]} != {reference}')
        if not math.isfinite(row['ns']) or row['ns'] < 0:
            raise ValueError('Timer returned a negative/non-finite duration')
    return observations


def report(data):
    cpu_math = 'software' if data['arithmetic'] == 'software' else 'hardware'
    gpu_math = 'software' if data['dtype'] == 'float64' or data['arithmetic'] == 'software' else 'hardware'
    lines = ['# Native tensor implementation comparison', '',
             'Kalandra uses built-in tensor operations with fusion/tiling/SIMD; comparator programs use handwritten reference kernels and materialize intermediates. This measures implementation choices and does not establish general compiler-performance parity or performance against optimized numerical libraries.', '',
             f"Recorded: {data['timestamp']}. {data['platform']}.", '',
             f"{data['dtype']} kernels, arithmetic policy `{data['arithmetic']}`. CPU cases are single-threaded; Metal uses the GPU. Times are microseconds per invocation, "
             'including intermediate allocation, result reduction and cleanup. '
             'Process startup, shader loading, compilation and input initialization are excluded. '
             'Python is the standard-library interpreter baseline, without NumPy/BLAS. It uses Python float (binary64); all chosen inputs, products and sums are exactly representable in both binary32 and binary64.', '',
             f'| Case | Size | Kalandra CPU ({cpu_math}) | Metal resident ({gpu_math}) | Metal transfers ({gpu_math}) | C++ | Go | Rust | Python |',
             '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |']
    for kind, n in data.get('workloads', WORKLOADS):
        rows = {row['language']: row for row in data['summary']
                if row['kind'] == kind and row['size'] == n}
        values = [f"{rows[language]['median_ns'] / 1000:.2f}" if language in rows else 'omitted' for language in LANGUAGES]
        lines.append(f"| {CASES[kind]} | {n} | " + ' | '.join(values) + ' |')
    if data.get('profiling'):
        lines += ['', '**Instrumented profiling run:** GPU command timestamps, host encoding time and submission/dispatch counts are retained in the raw JSON; use uninstrumented reports for speedup claims.']
    lines += ['', 'Each cell is the median of fresh-process medians; raw samples and commands '
              'are in the adjacent JSON. Different languages calibrate their batch iteration '
              'counts to the same target duration. These are straightforward equivalent '
              'algorithms, not optimized BLAS or end-to-end application rankings.', '',
              'Kalandra uses the compiler’s private test-entry adapter to accept runtime '
              'inputs. Its C++ driver only times calls and validates cleanup; the numerical '
              'kernels come from kernels.k. CPU uses no source-level tasks. '
              'Invocation setup/status/settle checks are included. GPU columns execute '
              'the same source expressions through the native Metal runtime. Resident '
              'excludes uploads but includes dispatch, synchronization and scalar readback; '
              'transfers also includes both uploads. Both include task-group retirement. '
              'Host buffer wrapping and shader/pipeline loading are outside both GPU timings. '
              'The hardware policy uses CPU/Metal floating instructions where supported. Metal float64 is available only with explicit software fallback; hardware-with-software-fallback retains hardware CPU float64 and Metal float32.', '',
              'No machine isolation, affinity or frequency control was applied. Allocation '
              'strategies, compiler transformations, bounds checks and Go GC may differ. '
              'Do not generalize one host’s results to language-wide performance.', '']
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--suite', choices=('default', 'gpu-scaling', 'gpu-vectors'), default='default')
    parser.add_argument('--languages', nargs='+', choices=LANGUAGES)
    parser.add_argument('--dtype', choices=('float32', 'float64'), default='float32')
    parser.add_argument('--arithmetic', choices=('hardware', 'software', 'hardware-with-software-fallback'), default='hardware')
    parser.add_argument('--compiler', type=Path, default=ROOT / 'build/native/native/kalandra')
    parser.add_argument('--clang', type=Path)
    parser.add_argument('--go', type=Path)
    parser.add_argument('--rustc', type=Path)
    parser.add_argument('--python', type=Path, default=Path(sys.executable))
    parser.add_argument('--output', type=Path)
    parser.add_argument('--cpu-only', action='store_true', help='Explicitly omit Metal on unsupported hosts')
    parser.add_argument('--verify-only', action='store_true')
    parser.add_argument('--profile', action='store_true', help='Record GPU timestamps/host encoding counters; instrumented results')
    parser.add_argument('--quick', action='store_true', help='1 process, 3 rounds, 20ms target; exploratory')
    args = parser.parse_args()
    if args.output and (args.output.exists() or args.output.with_suffix('.md').exists()):
        parser.error('output/report already exists; choose a new path to preserve measurements')
    lock = json.loads((ROOT / 'native/toolchain-proof/toolchain.json').read_text())
    try:
        tools = dict(kalandra=executable('kalandra', args.compiler),
                     cpp=executable('clang++', args.clang, Path(lock['defaultLlvmRoot']) / 'bin/clang++'),
                     go=executable('go', args.go),
                     rust=executable('rustc', args.rustc, Path.home() / '.rustup/toolchains/stable-aarch64-apple-darwin/bin/rustc'),
                     python=executable('python3', args.python))
        # Match Kalandra's pinned LLVM by default, instead of the OS's unrelated Clang.
        if not args.clang:
            tools['cpp'] = executable('clang++', Path(lock['defaultLlvmRoot']) / 'bin/clang++')
    except ValueError as error:
        parser.error(str(error))
    if not args.cpu_only and args.dtype == 'float64' and args.arithmetic == 'hardware':
        parser.error('Metal has no hardware float64: explicitly select --arithmetic hardware-with-software-fallback (or --cpu-only)')
    if not args.cpu_only and sys.platform != 'darwin':
        parser.error('Metal requires macOS; use --cpu-only for an explicitly CPU-only run')
    defaults = LANGUAGES if args.suite == 'default' else tuple(x for x in LANGUAGES if x != 'python')
    languages = tuple(x for x in (args.languages or defaults) if not args.cpu_only or not x.startswith('kalandra_gpu'))
    workloads = (WORKLOADS if args.suite == 'default' else
                 [(k,16777216) for k in (0,1)] if args.suite == 'gpu-vectors' else
                 [(k,n) for k in (0,1) for n in (262144,1048576,4194304)] + [(2,n) for n in (128,256,512,1024)])
    for name in ('MTL_DEBUG_LAYER', 'MTL_SHADER_VALIDATION', 'DYLD_INSERT_LIBRARIES'):
        if os.environ.get(name) not in (None, '', '0'):
            parser.error(f'{name} must be disabled before measuring performance')
    build = ROOT / 'benchmarks/.build/languages' / f'{args.dtype}-{args.arithmetic}'
    build.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, GOMAXPROCS='1', GOCACHE=str(build / 'go-cache'))
    env.pop('KALANDRA_GPU_PROFILE', None)
    if args.profile:
        env['KALANDRA_GPU_PROFILE'] = '1'
    commands = []
    def build_command(command):
        commands.append([str(x) for x in command])
        run(command, env)
    for source in ('kernels.k', 'gpu.k'):
        (build / source).write_text((SOURCE / source).read_text().replace('float64', args.dtype))
    (build / 'main.go').write_text((SOURCE / 'main.go').read_text().replace('type number = float64', 'type number = ' + args.dtype))
    (build / 'main.rs').write_text((SOURCE / 'main.rs').read_text().replace('type Scalar = f64', 'type Scalar = ' + ('f32' if args.dtype == 'float32' else 'f64')))
    clang = [tools['cpp'], '-std=c++23', '-O2', '-DNDEBUG', '-ffp-contract=off',
             '-Wall', '-Wextra', '-Werror', '-Wno-override-module', '-pthread', *(['-DBENCH_FLOAT32'] if args.dtype == 'float32' else [])]
    build_command([*clang, '-c', SOURCE / 'Kernel.cpp', '-o', build / 'cpp-kernel.o'])
    build_command([*clang, SOURCE / 'Driver.cpp', build / 'cpp-kernel.o', '-o', build / 'cpp'])
    build_command([tools['go'], 'build', '-trimpath', '-o', build / 'go', build / 'main.go'])
    build_command([tools['rust'], '-C', 'opt-level=2', '-C', 'lto=off', build / 'main.rs', '-o', build / 'rust'])
    for case in CASES:
        ir = build / f'{case}.ll'
        build_command([tools['kalandra'], build / 'kernels.k', '--arithmetic', args.arithmetic, '-o', build / f'{case}-standalone',
                       '--emit-llvm', ir, '--test-entry', case, '-O2'])
        build_command([*clang, '-DKALANDRA_KERNEL', *(['-DMATRIX_KERNEL'] if case == 'matrix' else []),
                       SOURCE / 'Driver.cpp', ir, ROOT / 'native/runtime/Runtime.cpp',
                       ROOT / 'native/runtime/Tasks.cpp', '-o', build / f'kalandra-{case}'])
    if not args.cpu_only:
        build_command([tools['kalandra'], build / 'gpu.k', '--arithmetic', args.arithmetic, '--target', 'metal', '-o', build / 'gpu-bundle', '-O2'])
        objects = []
        for index, source in enumerate([SOURCE / 'GpuDriver.cpp', ROOT / 'native/metal/Metal.mm',
                                       ROOT / 'native/runtime/Runtime.cpp', ROOT / 'native/runtime/Tasks.cpp']):
            obj = build / f'gpu-{index}.o'
            extra = ['-fobjc-arc', '-fblocks', '-fno-objc-msgsend-class-selector-stubs'] if source.suffix == '.mm' else []
            build_command([*clang, *extra, '-c', source, '-o', obj])
            objects.append(obj)
        build_command([tools['cpp'], '-O2', *objects, '-framework', 'Foundation', '-framework', 'Metal', '-o', build / 'gpu'])
    arithmetic_evidence = {'cpu': {}, 'metal': {}}
    for case in CASES:
        text = (build / f'{case}.ll').read_text()
        floating = bool(re.search(r'\b(fadd|fsub|fmul|fdiv)\b', text))
        wanted = args.arithmetic != 'software'
        if floating != wanted:
            raise ValueError(f'{case}: CPU arithmetic artifact does not match {args.arithmetic}')
        arithmetic_evidence['cpu'][case] = {'hardware_floating_operations': floating}
    if not args.cpu_only:
        for index, case in enumerate(CASES):
            text = (build / 'gpu-bundle' / f'kernel{index}.lowered.mlir').read_text()
            floating = bool(re.search(r'arith\.(addf|subf|mulf|divf)', text))
            wanted = args.dtype == 'float32' and args.arithmetic != 'software'
            if floating != wanted:
                raise ValueError(f'{case}: Metal arithmetic artifact does not match selected policy')
            arithmetic_evidence['metal'][case] = {'hardware_floating_operations': floating,
                                                  'software_fallback': args.dtype == 'float64'}
    programs = dict(cpp=[build / 'cpp'], go=[build / 'go'], rust=[build / 'rust'],
                    python=[tools['python'], SOURCE / 'main.py'])
    gpu_identity = None
    def measure(language, kind, n, iterations, rounds):
        nonlocal gpu_identity
        if language.startswith('kalandra_gpu'):
            program = [build / 'gpu', build / 'gpu-bundle', int(language.endswith('transfers'))]
        else:
            program = [build / f'kalandra-{CASES[kind]}'] if language == 'kalandra' else programs[language]
        rows = validate(run([*program, kind, n, iterations, rounds], env), kind, n, iterations, rounds)
        if language.startswith('kalandra_gpu'):
            for row in rows:
                gpu_identity = gpu_identity or row['device_id']
                if row['device_id'] != gpu_identity:
                    raise ValueError('GPU device changed between samples')
        return rows
    # Verify singleton and odd-sized reductions, not only the even measured sizes.
    for language in languages:
        for kind, n in EDGES:
            measure(language, kind, n, 1, 1)
        print(f'{language}: 9 edge workloads verified', flush=True)
    if args.verify_only:
        return
    processes, rounds, target_ms = (1, 3, 20) if args.quick else (3, 7, 75)
    iterations = {}
    for kind, n in workloads:
        for language in languages:
            sample = measure(language, kind, n, 1, 3)
            elapsed = statistics.median(row['ns'] for row in sample if row['round'] >= 0)
            iterations[language, kind, n] = max(1, min(100000, math.ceil(target_ms * 1e6 / max(1, elapsed))))
    observations = []
    rng = random.Random(20261024)
    for trial in range(processes):
        order = list(iterations)
        rng.shuffle(order)
        for language, kind, n in order:
            count = iterations[language, kind, n]
            samples = measure(language, kind, n, count, rounds)
            if any(s['ns'] <= 0 for s in samples if s['round'] >= 0):
                raise ValueError('Measured batch below timer resolution; increase batch size')
            observations.append(dict(language=language, kind=kind, case=CASES[kind], size=n,
                                     process=trial, iterations=count, samples=samples))
            print(f'{trial + 1}/{processes} {language:8} {CASES[kind]:6} {n}: '
                  f'{statistics.median(s["ns"] for s in samples if s["round"] >= 0) / count / 1000:.2f} us', flush=True)
    summaries = []
    for (language, kind, n), count in iterations.items():
        batches = [row for row in observations if (row['language'], row['kind'], row['size']) == (language, kind, n)]
        medians = [statistics.median(s['ns'] / count for s in row['samples'] if s['round'] >= 0) for row in batches]
        measured = [s['ns'] / count for row in batches for s in row['samples'] if s['round'] >= 0]
        summaries.append(dict(language=language, kind=kind, case=CASES[kind], size=n,
                              expected=expected(kind, n), iterations=count, median_ns=statistics.median(medians),
                              process_medians_ns=medians, min_ns=min(measured), max_ns=max(measured)))
    stamp = datetime.datetime.now(datetime.timezone.utc)
    sources = list(SOURCE.glob('*')) + [ROOT / path for path in ('native/metal/Metal.h', 'native/metal/Metal.mm', 'native/runtime/Runtime.cpp', 'native/runtime/Runtime.h', 'native/runtime/Tasks.cpp', 'native/runtime/Tasks.h', 'native/runtime/Tensor.h', 'native/runtime/NumericStorage.h', 'native/lib/Backend.cpp', 'native/lib/CheckedABI.cpp', 'native/lib/NumericConversion.cpp', 'native/lib/GpuConversion.cpp', 'native/include/kalandra/HardwareConversion.h', 'native/metal-source/Compiler.cpp', 'native/metal-source/Build.cpp', 'native/metal-source/HardwareShaders.h', 'native/lib/StrictFloat.cpp', 'native/include/kalandra/Arithmetic.h', 'native/toolchain-proof/toolchain.json')]
    versions = dict(cpp=run([tools['cpp'], '--version']), go=run([tools['go'], 'version']),
                    rust=run([tools['rust'], '--version', '--verbose']), python=run([tools['python'], '--version']))
    hardware = dict(machine=platform.machine(), processor=platform.processor(), logical_cpus=os.cpu_count())
    if sys.platform == 'darwin':
        hardware['cpu'] = run(['sysctl', '-n', 'machdep.cpu.brand_string']).strip()
    if not args.cpu_only:
        hardware['metal_device_id'] = gpu_identity
        hardware['displays'] = json.loads(run(['system_profiler', 'SPDisplaysDataType', '-json']))
    data = dict(schema=2, profiling=args.profile, workloads=workloads, suite=args.suite, arithmetic_evidence=arithmetic_evidence, dtype=args.dtype, arithmetic=args.arithmetic, cpu_only=args.cpu_only, timestamp=stamp.isoformat(), platform=platform.platform(), hardware=hardware,
                revision=run(['git', 'rev-parse', 'HEAD']).strip(), worktree_status=run(['git', 'status', '--short']),
                tool_paths={key: str(value) for key, value in tools.items()}, tool_versions=versions,
                compiler_sha256=hashlib.sha256(tools['kalandra'].read_bytes()).hexdigest(),
                source_sha256={str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
                               for path in sources if path.is_file()},
                artifact_sha256={str(path.relative_to(build)): hashlib.sha256(path.read_bytes()).hexdigest()
                                 for path in list(build.glob('*.ll')) + list(build.glob('*.k')) + [build / 'main.go', build / 'main.rs'] + list(build.glob('*.o')) + [build / 'cpp', build / 'go', build / 'rust'] + list(build.glob('kalandra-*')) + list((build / 'gpu-bundle').glob('*.metallib')) + ([build / 'gpu'] if not args.cpu_only else []) if path.is_file()},
                build_commands=commands, environment_overrides=dict(GOMAXPROCS='1', GOCACHE=env['GOCACHE']),
                protocol=dict(processes=processes, rounds=rounds, warmup_batches=2, target_ms=target_ms,
                              quick=args.quick, seed=20261024, edge_workloads_per_language=len(EDGES)),
                observations=observations, summary=summaries)
    output = args.output or ROOT / f'benchmarks/results/languages-{args.dtype}-{args.arithmetic}-{stamp:%Y%m%dT%H%M%SZ}.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, indent=2) + '\n')
    output.with_suffix('.md').write_text(report(data))
    print(f'Results: {output}\nReport: {output.with_suffix(".md")}')


if __name__ == '__main__':
    main()
