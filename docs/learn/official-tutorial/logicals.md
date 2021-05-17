# Logicals

Clio supports `and`, `or` and `not` keywords:

```text
fn isEven n:
  n % 2 == 0 and not n == 0

fn isOdd n:
  not (isEven n)

export fn main argv:
  isEven 10 -> console.log
  isOdd 10 -> console.log

  (isOdd 10) or (isEven 10) -> console.log
  (isOdd 10) or not (isEven 10) -> console.log
```

[Try on playground.](https://clio-playground-pouyae.vercel.app/?code=fn%20isEven%20n%3A%0A%20%20n%20%25%202%20%3D%3D%200%20and%20not%20n%20%3D%3D%200%0A%0Afn%20isOdd%20n%3A%0A%20%20not%20%28isEven%20n%29%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20isEven%2010%20-%3E%20console.log%0A%20%20isOdd%2010%20-%3E%20console.log%0A%0A%20%20%28isOdd%2010%29%20or%20%28isEven%2010%29%20-%3E%20console.log%0A%20%20%28isOdd%2010%29%20or%20not%20%28isEven%2010%29%20-%3E%20console.log)

