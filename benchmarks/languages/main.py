import sys,time,json
work=sys.argv[1]; n,batch,seed,warm,samples=map(int,sys.argv[2:])
def fib(n): return n if n<2 else fib(n-1)+fib(n-2)
def recurrence(n,v):
    for _ in range(n): v=(v*17.0+23.0)%1000003.0
    return v
def dot(a,b):
    v=0.0
    for i in range(len(a)): v+=a[i]*b[i]
    return v
a=[(i%97)/97.0 for i in range(n)]; b=[((i%89)+1)/89.0 for i in range(n)]
def run():
    v=0.0
    for j in range(batch):
        if work=='fib': v+=fib(float(n+j%3))
        elif work=='recurrence': v+=recurrence(n,float(seed+j))
        else:
            a[0]=float(seed+j); v+=dot(a,b)
    return v
for _ in range(warm): result=run()
times=[]; checks=[]
for _ in range(samples):
    start=time.perf_counter_ns(); result=run(); times.append((time.perf_counter_ns()-start)/1e6); checks.append(result)
print(json.dumps(dict(times=times,checksums=checks)))
