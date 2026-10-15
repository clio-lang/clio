#!/usr/bin/env python3
"""Compare isolated strict GPU matmul layouts; never changes production policy."""
import argparse
import datetime
import json
import os
import pathlib
import platform
import re
import shutil
import statistics
import time
from gpu import ROOT, digest, run


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--compiler', type=pathlib.Path, default=ROOT / 'build/native/native/kalandrac')
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('output exists; choose another path to preserve measurements')
    llvm = pathlib.Path(json.loads((ROOT / 'native/toolchain-proof/toolchain.json').read_text())['defaultLlvmRoot'])
    lock = json.loads((ROOT / 'native/metal-proof/toolchain.json').read_text())
    build = ROOT / 'benchmarks/.build/gpu-tiling'
    kernels = build / 'kernels'
    build.mkdir(parents=True, exist_ok=True)
    commands = []
    def execute(command):
        commands.append([str(v) for v in command])
        return run(command, timeout=600)
    started = time.monotonic()
    execute([args.compiler.resolve(), ROOT / 'native/benchmarks/gpu.kalandra', '--target', 'metal', '-o', kernels, '-O2'])
    for suffix in ['mlir', 'lowered.mlir', 'spv', 'metallib']:
        shutil.copyfile(kernels / f'kernel0.{suffix}', kernels / f'scalar.{suffix}')
    variants = ['scalar', 'shared8x8', 'register2x2', 'register2x1']
    for name in variants[1:]:
        base = kernels / name
        source = ROOT / 'native/benchmarks/gpu-tiling' / f'{name}.mlir'
        shutil.copyfile(source, base.with_suffix('.mlir'))
        execute([ROOT / 'build/native/native/metal-proof/kalandra-metal-strict', source, base.with_suffix('.lowered.mlir')])
        execute([llvm / 'bin/mlir-opt', base.with_suffix('.lowered.mlir'), '--verify-each',
                 '--pass-pipeline=builtin.module(canonicalize,cse,convert-gpu-to-spirv,spirv.module(spirv-lower-abi-attrs,spirv-update-vce))',
                 '-o', base.with_suffix('.converted.mlir')])
        execute([ROOT / 'build/native/native/metal-proof/kalandra-metal-extract', base.with_suffix('.converted.mlir'), base.with_suffix('.kernel.mlir'), '--metal-compiler-rounding'])
        execute([llvm / 'bin/mlir-translate', '--no-implicit-module', '--serialize-spirv', base.with_suffix('.kernel.mlir'), '-o', base.with_suffix('.spv')])
        execute([pathlib.Path(lock['spirvToolsRoot']) / 'bin/spirv-val', '--target-env', 'vulkan1.0', base.with_suffix('.spv')])
        execute([pathlib.Path(lock['spirvCrossRoot']) / 'bin/spirv-cross', base.with_suffix('.spv'), '--msl', '--msl-version', '20200', '--output', base.with_suffix('.metal')])
        execute(['xcrun', '--toolchain', lock['metalToolchain'], '--sdk', 'macosx', 'metal', '-std=macos-metal2.2', '-fno-fast-math', '-ffp-contract=off',
                 '-fmodules-cache-path=' + str(build / 'module-cache'), '-c', base.with_suffix('.metal'), '-o', base.with_suffix('.air')])
        execute(['xcrun', '--toolchain', lock['metalToolchain'], 'metal', base.with_suffix('.air'), '-o', base.with_suffix('.metallib')])
    for name in variants:
        module = kernels / ('kernel0.kernel.mlir' if name == 'scalar' else f'{name}.kernel.mlir')
        if re.search(r'spirv\.(FAdd|FMul|FDiv)|Fma|FPFastMathMode', module.read_text()):
            raise RuntimeError(f'{name}: strict SPIR-V arithmetic audit failed')
    sources = [ROOT / 'native/benchmarks/GpuTiling.mm', ROOT / 'native/metal/Metal.mm',
               ROOT / 'native/runtime/Runtime.cpp', ROOT / 'native/runtime/Tasks.cpp', kernels / 'cpu.ll']
    flags = ['-std=c++23', '-Wall', '-Wextra', '-Werror', '-DNDEBUG', '-ffp-contract=off']
    binaries = []
    for variant in ['optimized', 'sanitized']:
        variant_flags = ['-O2'] if variant == 'optimized' else ['-O1', '-g', '-fsanitize=address,undefined', '-fno-sanitize-recover=all', '-fno-omit-frame-pointer']
        objects = []
        for i, source in enumerate(sources):
            obj = build / f'{variant}-{i}.o'
            extra = ['-fobjc-arc', '-fblocks'] if source.suffix == '.mm' else []
            if source.suffix == '.ll':
                extra += ['-Wno-override-module']
            else:
                extra += ['-isystem', str(llvm / 'include')]
            execute([llvm / 'bin/clang++', *flags, *variant_flags, *extra, '-c', source, '-o', obj])
            objects.append(obj)
        binary = build / variant
        execute([llvm / 'bin/clang++', *variant_flags, *objects, '-L' + str(llvm / 'lib'), '-lLLVM', '-Wl,-rpath,' + str(llvm / 'lib'),
                 '-framework', 'Foundation', '-framework', 'Metal', '-o', binary])
        binaries.append(binary)
    build_seconds = time.monotonic() - started
    env = os.environ.copy()
    for key in ['MTL_DEBUG_LAYER', 'MTL_SHADER_VALIDATION', 'DYLD_INSERT_LIBRARIES']:
        if env.get(key) not in (None, '', '0'):
            parser.error(f'{key} must be disabled for performance measurements')
        env.pop(key, None)
    qualification = []
    for binary in binaries:
        print(f'Qualifying {binary.name}', flush=True)
        checked = run([binary, kernels, '--verify'], timeout=600, env={**env, 'MTL_DEBUG_LAYER': '1'})
        qualification.append(dict(binary=binary.name, result=json.loads(checked)['qualification']))
    trials = []
    for process in range(3):
        print(f'Timing process {process+1}/3', flush=True)
        lines = [json.loads(line) for line in run([binaries[0], kernels, 2, 7, process], timeout=600, env=env).splitlines()]
        assert len(lines) == 1 + 8 * 4 * 7
        trials.append(dict(metadata=lines[0]['metadata'], samples=lines[1:]))
    assert all(t['metadata'] == trials[0]['metadata'] for t in trials)
    summary = []
    for workload in sorted({r['workload'] for r in trials[0]['samples']}):
        for name in variants:
            rows = [[r for r in t['samples'] if r['variant'] == name and r['workload'] == workload] for t in trials]
            assert all(len(v) == 7 for v in rows)
            row = dict(workload=workload, variant=name)
            for metric in ['gpu_ms', 'wall_ms']:
                values = [[r[metric] for r in v] for v in rows]
                medians = [statistics.median(v) for v in values]
                row[metric] = statistics.median(medians)
                row[metric + '_process_medians'] = medians
                row[metric + '_min'] = min(map(min, values))
                row[metric + '_max'] = max(map(max, values))
            summary.append(row)
    source_paths = [s for s in sources if s != kernels / 'cpu.ll'] + [ROOT / 'native/benchmarks/GpuScaling.mm',
        ROOT / 'native/benchmarks/gpu_tiling.py', ROOT / 'native/benchmarks/gpu.py', ROOT / 'native/lib/StrictFloat.cpp',
        ROOT / 'native/metal-source/MatmulShader.h', ROOT / 'native/metal-proof/FloatOracle.h',
        ROOT / 'native/metal-source/Build.cpp', ROOT / 'native/toolchain-proof/toolchain.json', ROOT / 'native/metal-proof/toolchain.json']
    source_paths += list((ROOT / 'native/benchmarks/gpu-tiling').glob('*.mlir'))
    artifacts = [*binaries, args.compiler, kernels / 'cpu.ll']
    for name in variants:
        artifacts += [kernels / f'{name}.{suffix}' for suffix in ['mlir', 'lowered.mlir', 'spv', 'metallib']]
    machine = {key: run(['sysctl', '-n', key]).strip() for key in ['machdep.cpu.brand_string', 'hw.logicalcpu', 'hw.memsize']}
    result = dict(platform=platform.platform(), machine=machine, clang=run([llvm / 'bin/clang++', '--version']).strip(), timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(), revision=run(['git', 'rev-parse', 'HEAD']).strip(),
                  worktree_status=run(['git', 'status', '--short']), production_policy_changed=False, strict_spirv_audit_passed=True, build_seconds=build_seconds,
                  protocol=dict(processes=3, warmups=2, samples=7, shuffled_variants_each_round=True, shuffled_workloads_each_process=True,
                                timing='preallocated resident compute command GPU timestamps; encode/submit/wait wall; validation readback separate and untimed',
                                shader_policy='strict integer binary32, separately rounded products, fixed adjacent tree',
                                timing_sanitizers=False, timing_validation=False, qualification_metal_api_validation=True,
                                jit=False, managed_tasks_measured=False, cpu_performance_measured=False,
                                sanitizer_scope='C++/Objective-C++ host ASan/UBSan; GPU and prebuilt LLVM uninstrumented; generated CPU control unused in this study'),
                  commands=commands, qualification=qualification, trials=trials, summary=summary,
                  sources_sha256={str(p.relative_to(ROOT)): digest(p) for p in source_paths},
                  artifacts_sha256={str(p.resolve().relative_to(ROOT)): digest(p) for p in artifacts})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    for r in summary:
        print(f"{r['workload']:20} {r['variant']:14} GPU={r['gpu_ms']:.4f} ms")
    print(args.output)


if __name__ == '__main__':
    main()
