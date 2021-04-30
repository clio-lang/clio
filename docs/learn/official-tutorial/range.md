# Range

Clio supports range literals. To define them, you can write:

```text
export fn main argv:
  start..end by step
```

with `start`, `end` and `by step` being optional:

```text
export fn main argv:
  by 2 -- zero to infinity, step is 2
  10.. -- 10 to infinity
  ..100 by 3 -- 0 to 100, step is 3 
```

