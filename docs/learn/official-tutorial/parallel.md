# Parallelism

In Clio there are two versions of each function, regular and distributed. To get the distributed version of a function we can use the sandwich syntax:

```text
fn fib n:
  if n < 2: n
  else: (fib n - 1)
      + (fib n - 2)

export fn main argv:
  [39 40 41 42]
    -> * await |fib|
    -> * console.log
```

Please note that the distributed version of a function is always async and needs to be awaited.