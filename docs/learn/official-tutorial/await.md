# Async/Await

JavaScript supports async functions, so does Clio. However, unlike JavaScript Clio doesn't have an `async` keyword. Simply using an `await` keyword in your function marks it as async. The `await` keyword can be used in flows:

```text
export fn main argv:
  "https://get.geojs.io/v1/ip/geo.json"
    -> await fetch
    -> await .json
    -> console.log
```

[Try on playground.](https://playground.clio-lang.org/?code=export%20fn%20main%20argv%3A%0A%20%20%22https%3A%2F%2Fget.geojs.io%2Fv1%2Fip%2Fgeo.json%22%0A%20%20%20%20-%3E%20await%20fetch%0A%20%20%20%20-%3E%20await%20.json%0A%20%20%20%20-%3E%20console.log)

It can also be used outside flows:

```text
export fn main argv:
  await fetch "https://get.geojs.io/v1/ip/geo.json"
    -> await .json
    -> console.log
```

[Try on playground.](https://playground.clio-lang.org/?code=export%20fn%20main%20argv%3A%0A%20%20await%20fetch%20%22https%3A%2F%2Fget.geojs.io%2Fv1%2Fip%2Fgeo.json%22%0A%20%20%20%20-%3E%20await%20.json%0A%20%20%20%20-%3E%20console.log)

Clio also supports `[await]` keyword, which translates to `await Promise.all(...)`:

```text
export fn main argv:
  urls = [
    "https://get.geojs.io/v1/ip/geo.json"
    "https://get.geojs.io/v1/ip/geo/8.8.8.8.json"
  ]
    
  urls  -> * [await] (fetch @it)
        -> * [await] .json
        -> * console.log
```

[Try on playground.](https://playground.clio-lang.org/?code=export%20fn%20main%20argv%3A%0A%20%20urls%20%3D%20%5B%0A%20%20%20%20%22https%3A%2F%2Fget.geojs.io%2Fv1%2Fip%2Fgeo.json%22%0A%20%20%20%20%22https%3A%2F%2Fget.geojs.io%2Fv1%2Fip%2Fgeo%2F8.8.8.8.json%22%0A%20%20%5D%0A%20%20%20%20%0A%20%20urls%20%20-%3E%20*%20%5Bawait%5D%20%28fetch%20%40it%29%0A%20%20%20%20%20%20%20%20-%3E%20*%20%5Bawait%5D%20.json%0A%20%20%20%20%20%20%20%20-%3E%20*%20console.log)

