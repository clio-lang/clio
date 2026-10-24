"""Diagnostic ablations, not performance qualification or production safety changes.

Prerequisite: build and run native/benchmarks/fair/{source,libraries}_run.py.
All modified LLVM/runtime copies and binaries stay in ignored benchmarks/.build.
"""
import argparse,json,os,re,sys,statistics
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent/'fair'))
import protocol as p
import source_run as source
import library_reference as ref

def conversions(text):
    changed=0
    def function(match):
        nonlocal changed
        body=match[0]
        conditions=[]
        for m in re.finditer(r'br i1 (%[\w.]+), label %(\w+), label %(\w+)',body):
            if re.search(r'^'+re.escape(m[2])+r':[^\n]*\n  %[\w.]+ = sitofp i64 ',body,re.M):conditions.append(m[1])
        for condition in set(conditions):
            body,n=re.subn(r'^(  '+re.escape(condition)+r' = )[^\n]+',r'\1icmp eq i64 0, 0',body,flags=re.M)
            assert n==1,(condition,n);changed+=1
        return body
    text=re.sub(r'^define [\s\S]*?^}',function,text,flags=re.M)
    assert changed>0,'no conversion guards found'
    return text,changed

def guards(text):
    text,n=re.subn(r'^(  %[\w.]+ = )call i1 @kalandra_call_enter_v1\([^\n]+',r'\1icmp eq i64 0, 0',text,flags=re.M)
    assert n>0
    text=re.sub(r'^  call void @kalandra_call_leave_v1\([^\n]+\n','',text,flags=re.M)
    return re.sub(r'^(  %[\w.]+ = )call i64 @kalandra_poll_v1\([^\n]+',r'\1add i64 0, 0',text,flags=re.M)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    assert not args.output.exists()
    build=p.BUILD.parent/'bottlenecks';build.mkdir(exist_ok=True)
    compiler=p.ROOT/'build/native/native/kalandra';archive=compiler.parent/'libkalandra-task-core-optimized.a'
    flags=['-std=c++23','-O2','-ffp-contract=off','-Wno-override-module','-pthread']
    runtime=p.ROOT/'native/runtime/Runtime.cpp'
    text=runtime.read_text();start=text.index('#if defined(__APPLE__)',text.index('bool Invocation::enterCall'));end=text.index('#endif',start)+len('#endif')
    modified=text[:start]+'// DIAGNOSTIC ONLY: stack boundary check removed.\n'+text[end:]
    runtime_copy=build/'Runtime-no-stack-query.cpp';runtime_copy.write_text(modified)
    p.run([p.CLANG,*flags,'-iquote',str(runtime.parent),'-c',runtime_copy,'-o',build/'Runtime.cpp.o'])
    alternative=build/'no-stack-query.a';alternative.write_bytes(archive.read_bytes())
    p.run([p.CLANG.parent/'llvm-ar','r',alternative,build/'Runtime.cpp.o'])
    variants=('baseline','no-stack-query','no-conversion-admission','no-call-guards','no-guards-or-conversion','no-guards-conversion-inline')
    mutation_counts={}
    for name in source.NAMES:
        original=(p.BUILD/'source'/(name+'.ll')).read_text()
        for variant in variants:
            ir=original
            if variant in ('no-call-guards','no-guards-or-conversion','no-guards-conversion-inline'):ir=guards(ir)
            if variant in ('no-conversion-admission','no-guards-or-conversion','no-guards-conversion-inline'):
                ir,n=conversions(ir);mutation_counts[name]=n
            if variant.endswith('-inline'):
                ir=ir.replace('noinline','')
                for group in re.findall(r'^attributes #(\d+) = \{\s*\}$',ir,re.M):
                    ir=re.sub(r'^attributes #'+group+r' = \{\s*\}\n','',ir,flags=re.M)
                    ir=re.sub(r' #'+group+r'(?=\s|$)','',ir)
            path=build/(name+'-'+variant+'.ll');path.write_text(ir)
            p.run([p.CLANG,*flags,'-DKALANDRA_KERNEL',p.ROOT/'native/benchmarks/fair/SourceDriver.cpp',path,alternative if variant=='no-stack-query' else archive,'-o',path.with_suffix('')])
    def invoke(cell,count,rounds):
        name,variant=cell;kind=source.NAMES.index(name)
        return p.observations(p.run([build/(name+'-'+variant),kind,14,count,rounds,17]),source.expected(kind,14),count,rounds)
    cells=[[name,variant] for name in source.NAMES for variant in variants]
    result=p.measure(cells,invoke,lambda c:source.expected(source.NAMES.index(c[0]),14),rounds=5)
    result.update(warning='Diagnostic sensitivity only. Guard-removal variants disable cancellation/stack protection and are not valid language implementations. Conversion-admission simplification concerns integer64 -> float64 only. No production sources or fair-suite artifacts are modified.',conversion_guards_simplified=mutation_counts)
    # CPU matrix: isolate polling cost while preserving the same matrix arithmetic/tree.
    original=p.BUILD/'libraries/float32/matrix.ll';text=original.read_text()
    text,n=re.subn(r'^(  %[\w.]+ = )call i64 @kalandra_poll_v1\([^\n]+',r'\1add i64 0, 0',text,flags=re.M);assert n>0
    path=build/'matrix-no-polls.ll';path.write_text(text)
    driver=p.BUILD/'libraries/float32/Driver.cpp'
    p.run([p.CLANG,*flags,'-DBENCH_FLOAT32','-DKALANDRA_KERNEL','-DMATRIX_KERNEL',driver,path,archive,'-o',build/'matrix-no-polls'])
    def matrix(cell,count,rounds):
        binary=p.BUILD/'libraries/float32/kalandra-matrix' if cell[0]=='baseline' else build/'matrix-no-polls'
        return p.observations(p.run([binary,2,1024,count,rounds]),ref.exact(2,1024),count,rounds)
    result['matrix_poll_ablation']=p.measure([['baseline'],['no-polls']],matrix,lambda c:ref.exact(2,1024),rounds=5)
    # Opt-in command buffer GPU duration/encoding counters, separate from acceptance timings.
    env=dict(os.environ,KALANDRA_GPU_PROFILE='1');gpu=[]
    for trial in range(3):
        for kind,n in ((0,4194304),(1,4194304),(2,512),(2,1024)):
            for transfers in (0,1):
                count=8 if kind==2 else 40
                rows=p.observations(p.run([p.BUILD/'libraries/float32/gpu',p.BUILD/'libraries/float32/gpu-bundle',transfers,kind,n,count,5],env),ref.exact(kind,n),count,5)
                gpu.append(dict(process=trial,kind=kind,n=n,transfers=transfers,iterations=count,samples=rows))
                print('GPU profile',trial,kind,n,transfers,flush=True)
    result['gpu_profile']=gpu
    inputs=[Path(__file__),runtime,p.ROOT/'native/runtime/Runtime.h',p.ROOT/'native/lib/NumericConversion.cpp',p.ROOT/'native/lib/Backend.cpp',p.ROOT/'native/metal-source/HardwareShaders.h',p.ROOT/'native/metal/Metal.mm']
    artifacts=[x for x in build.iterdir() if x.is_file()]+[archive]
    p.evidence(args.output,result,inputs,artifacts,compiler)
if __name__=='__main__':main()
