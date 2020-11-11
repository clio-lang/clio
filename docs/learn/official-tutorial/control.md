# Control Flow

There are no loops in Clio and all loops should be done using recursion. There is support for if, else if, else statements:

```
export fn main argv:
  10 => x
  if x > 10:
    console.log "x is bigger!"
  else if x < 10:
    console.log "x is smaller!"
  else:
    console.log "x equals ten!"
```

Instead of blocks you can also use an expression:

```
fn zeroify n:
  if n < 0: n + 1
  else:     n - 1

export fn main argv:
  9 -> zeroify
```
