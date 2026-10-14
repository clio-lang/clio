"""Run from the repository root: python3 benchmarks/run.py."""
import hashlib,json,math,os,platform,random,shutil,statistics,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
BASE=ROOT/'benchmarks'; BUILD=BASE/'.build'; BUILD.mkdir(exist_ok=True)
ENV=dict(os.environ,GOCACHE=str(BUILD/'go-cache'))

def command(args,timeout=120):
    start=time.perf_counter()
    p=subprocess.run(list(map(str,args)),cwd=ROOT,env=ENV,capture_output=True,text=True,timeout=timeout)
    if p.returncode: raise RuntimeError(f'{args}:\n{p.stdout}\n{p.stderr}')
    return p.stdout.strip(),(time.perf_counter()-start)*1000

def version(args):
    p=subprocess.run(args,cwd=ROOT,env=ENV,capture_output=True,text=True)
    return (p.stdout+p.stderr).strip()

builds=[]
for args in [
 ['bun','run','cli','compile',BASE/'languages/kernels.kalandra','-o',BUILD/'kernels.kalandra.mjs'],
 ['clang','-O3','-ffp-contract=off','-std=c17',BASE/'languages/main.c','-lm','-o',BUILD/'c'],
 ['clang++','-x','c++','-O3','-ffp-contract=off','-std=c++20',BASE/'languages/main.c','-o',BUILD/'cpp'],
 ['clang','-O3','-ffp-contract=off','-std=c17','-DINTEGER_RECURRENCE',BASE/'languages/main.c','-lm','-o',BUILD/'c-integer'],
 ['go','build','-o',BUILD/'go',BASE/'languages/main.go'],
 ['javac','-d',BUILD,BASE/'languages/Main.java'],
]:
    print('Building',args[0],flush=True); _,ms=command(args); builds.append({'command':list(map(str,args)),'elapsedMs':ms})

variants={
 'Kalandra / Bun':['bun',BASE/'languages/run.mjs',BUILD/'kernels.kalandra.mjs'],
 'Kalandra / Node':['node',BASE/'languages/run.mjs',BUILD/'kernels.kalandra.mjs'],
 'JavaScript / Bun':['bun',BASE/'languages/run.mjs',BASE/'languages/kernels.mjs'],
 'JavaScript / Node':['node',BASE/'languages/run.mjs',BASE/'languages/kernels.mjs'],
 'C / Clang -O3':[BUILD/'c'], 'C++ / Clang -O3':[BUILD/'cpp'], 'Go':[BUILD/'go'],
 'Java / HotSpot':['java','-cp',BUILD,'Main'],
 'Python / CPython':['python3',BASE/'languages/main.py'],
 'Ruby':['ruby',BASE/'languages/main.rb'],
 'C / integer control':[BUILD/'c-integer'],
}
workloads={'fib':{'n':28,'batch':3},'recurrence':{'n':250000,'batch':3},'dot':{'n':100000,'batch':3}}
warmups=5;samples=9;rounds=3;seed=123

def expected(work,n,batch):
    if work=='fib':
        def fib(n):
            a,b=0,1
            for _ in range(n):a,b=b,a+b
            return a
        return sum(fib(n+j%3) for j in range(batch))
    if work=='recurrence':
        result=0
        for j in range(batch):
            v=seed+j
            for _ in range(n):v=(v*17+23)%1000003
            result+=v
        return result
    return sum(math.fsum(((seed+j) if i==0 else (i%97)/97)*(((i%89)+1)/89) for i in range(n)) for j in range(batch))

expected_values={w:expected(w,**p) for w,p in workloads.items()}
results=[]; rng=random.Random(20261013)
for round in range(rounds):
    jobs=[(name,work) for name in variants for work in workloads if name!='C / integer control' or work=='recurrence'];rng.shuffle(jobs)
    for name,work in jobs:
        p=workloads[work];args=[*variants[name],work,p['n'],p['batch'],seed,warmups,samples]
        output,wall=command(args);data=json.loads(output)
        assert len(data['times'])==len(data['checksums'])==samples
        assert all(math.isfinite(t) and t>0 for t in data['times'])
        assert all(math.isclose(v,expected_values[work],rel_tol=1e-10,abs_tol=1e-8) for v in data['checksums']),(name,work,data,expected_values[work])
        results.append(dict(variant=name,workload=work,round=round+1,command=list(map(str,args)),processWallMs=wall,**data))
        print(f'{round+1}/{rounds} {name:20} {work:10} {statistics.median(data["times"]):9.3f} ms',flush=True)
summary=[]
for work in workloads:
    for name in variants:
        rows=[r for r in results if r['variant']==name and r['workload']==work]
        if not rows: continue
        medians=[statistics.median(r['times']) for r in rows]
        summary.append(dict(variant=name,workload=work,medianMs=statistics.median(medians),processMediansMs=medians,minProcessMedianMs=min(medians),maxProcessMedianMs=max(medians)))
metadata={'platform':platform.platform(),'architecture':platform.machine(),'logicalCpus':os.cpu_count(),'toolchains':{name:version(args) for name,args in {'bun':['bun','--version'],'node':['node','--version'],'clang':['clang','--version'],'go':['go','version'],'java':['java','--version'],'python':['python3','--version'],'ruby':['ruby','--version']}.items()},'hardware':version(['sysctl','-n','machdep.cpu.brand_string','hw.memsize','hw.ncpu']), 'sourceHashes':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((BASE/'languages').iterdir()) if p.is_file()}}
report=dict(metadata=metadata,settings=dict(warmups=warmups,samplesPerProcess=samples,processesPerVariant=rounds,seed=seed,orderSeed=20261013,workloads=workloads),expected=expected_values,builds=builds,summary=summary,raw=results)
path=BASE/'results'/'2026-10-13-local.json';path.write_text(json.dumps(report,indent=2)+'\n')
print('Saved',path,flush=True)
