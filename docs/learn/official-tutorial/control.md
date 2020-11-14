# Control Flow

There are no loops in Clio and all loops should be done using recursion. There is support for if, else if, else statements:

```text
fn isBigger x:
  if x > 10:
    console.log "x is bigger!"
  else if x < 10:
    console.log "x is smaller!"
  else:
    console.log "x equals ten!"

export fn main argv:
  isBigger 10
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=fn%20isBigger%20x%3A%0A%20%20if%20x%20%3E%2010%3A%0A%20%20%20%20console.log%20%22x%20is%20bigger!%22%0A%20%20else%20if%20x%20%3C%2010%3A%0A%20%20%20%20console.log%20%22x%20is%20smaller!%22%0A%20%20else%3A%0A%20%20%20%20console.log%20%22x%20equals%20ten!%22%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20isBigger%2010%0A)

Instead of blocks you can also use an expression:

```text
fn zeroify n:
  if n < 0: n + 1
  else:     n - 1

export fn main argv:
  9 -> zeroify -> console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=fn%20zeroify%20n%3A%0A%20%20if%20n%20%3C%200%3A%20n%20%2B%201%0A%20%20else%3A%20%20%20%20%20n%20-%201%0A%0Aexport%20fn%20main%20argv%3A%0A%20%209%20-%3E%20zeroify%20-%3E%20console.log)

You can also wrap an if / else in a pair of parentheses and treat it as an expression:

```text
fn sign n:
  (if n < 0: 'negative' else: 'positive')
    -> console.log

export fn main argv:
  sign -1
```

\[Try on playground.\]\(\[[https://clio-playground.pouyae.vercel.app/?code=fn](https://clio-playground.pouyae.vercel.app/?code=fn) sign n%3A%0A %28if n %3C 0%3A 'negative' else%3A 'positive'%29%0A -%3E console.log%0A%0Aexport fn main argv%3A%0A sign -1\]\([https://clio-playground.pouyae.vercel.app/?code=fn sign n%3A%0A  %28if n %3C 0%3A 'negative' else%3A 'positive'%29%0A    -%3E console.log%0A%0Aexport fn main argv%3A%0A  sign -1\)\](https://clio-playground.pouyae.vercel.app/?code=fn%20sign%20n%3A%0A%20%20%28if%20n%20%3C%200%3A%20'negative'%20else%3A%20'positive'%29%0A%20%20%20%20-%3E%20console.log%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20sign%20-1%29\)\)

