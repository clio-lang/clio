# Logicals

Clio supports `and`, `or` and `not` keywords:

```text
fn is-even n:
  n % 2 = 0 and n != 0

fn is-odd n:
  not is-even n

export fn main argv:
  is-even 10 -> console.log
  is-odd 10 -> console.log

  (is-odd 10) or (is-even 10) -> console.log
  (is-odd 10) or (not is-even 10) -> console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=fn%20is-even%20n%3A%0A%20%20n%20%25%202%20%3D%200%20and%20n%20!%3D%200%0A%0Afn%20is-odd%20n%3A%0A%20%20not%20is-even%20n%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20is-even%2010%20-%3E%20console.log%0A%20%20is-odd%2010%20-%3E%20console.log%0A%0A%20%20%28is-odd%2010%29%20or%20%28is-even%2010%29%20-%3E%20console.log%0A%20%20%28is-odd%2010%29%20or%20%28not%20is-even%2010%29%20-%3E%20console.log)
