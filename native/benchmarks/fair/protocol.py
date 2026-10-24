"""Shared repeated-process protocol; all measured and warmup outputs are validated."""
import datetime,hashlib,json,math,os,platform,random,statistics,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
CLANG=Path(json.loads((ROOT/'native/toolchain-proof/toolchain.json').read_text())['defaultLlvmRoot'])/'bin/clang++'
RUST=Path.home()/'.rustup/toolchains/stable-aarch64-apple-darwin/bin/rustc'
BUILD=ROOT/'benchmarks/.build/fair'
COMMANDS=[]
def run(argv,env=None,timeout=360):
    argv=list(map(str,argv)); COMMANDS.append(argv)
    p=subprocess.run(argv,cwd=ROOT,env=env,text=True,capture_output=True,timeout=timeout)
    if p.returncode:raise RuntimeError(f'{argv}: {p.returncode}\n{p.stdout}\n{p.stderr}')
    return p.stdout
def key(path):
    path=Path(path)
    return str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path)
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def observations(output,expected,count,rounds):
    rows=[json.loads(x) for x in output.splitlines()]
    assert [r['round'] for r in rows]==list(range(-2,rounds)),rows
    for row in rows:
        assert math.isfinite(row['ns']) and row['ns']>=0,row
        assert type(row['checksum']) in (int,float) and math.isfinite(row['checksum']) and float(row['checksum'])==expected*count,(row,expected,count)
    return rows

def measure(cells,invoke,reference,processes=3,rounds=7,target_ms=50):
    counts={}
    for cell in cells:
        samples=invoke(cell,1,3)
        elapsed=statistics.median(r['ns'] for r in samples if r['round']>=0)
        counts[tuple(cell)]=max(1,min(20000,math.ceil(target_ms*1e6/max(1,elapsed))))
    records=[];rng=random.Random(20261024)
    for trial in range(processes):
        order=list(cells);rng.shuffle(order)
        for cell in order:
            count=counts[tuple(cell)];samples=invoke(cell,count,rounds)
            assert all(s['ns']>0 for s in samples if s['round']>=0),'batch below timer resolution'
            row=dict(cell=cell,process=trial,iterations=count,samples=samples)
            records.append(row)
            median=statistics.median(r['ns']/count for r in samples if r['round']>=0)
            print(f'{trial+1}/{processes} {cell}: {median/1000:.3f} us',flush=True)
    summary=[]
    for cell in cells:
        groups=[r for r in records if r['cell']==cell]
        medians=[statistics.median(s['ns']/r['iterations'] for s in r['samples'] if s['round']>=0) for r in groups]
        summary.append(dict(cell=cell,expected=reference(cell),median_ns=statistics.median(medians),process_medians_ns=medians))
    return dict(protocol=dict(processes=processes,rounds=rounds,warmups=2,target_ms=target_ms,max_iterations=20000,seed=20261024),observations=records,summary=summary)

def evidence(output,data,sources,binaries,compiler):
    assert not output.exists() and not output.with_suffix('.md').exists(),'choose new output paths'
    data.update(schema=1,timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                compiler_sha256=sha(compiler),source_sha256={key(p):sha(p) for p in sources},
                artifact_sha256={key(p):sha(p) for p in binaries},commands=COMMANDS,
                revision=run(['git','rev-parse','HEAD']).strip(),worktree_status=run(['git','status','--short']),
                system=platform.platform(),versions=dict(python=sys.version,clang=run([CLANG,'--version']),rust=run([RUST,'--version','--verbose']),go=run(['go','version'])),
                cpu=run(['sysctl','-n','machdep.cpu.brand_string']).strip())
    output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(data,indent=2)+'\n')
