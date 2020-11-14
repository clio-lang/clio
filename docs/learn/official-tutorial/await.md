# Async/Await

JavaScript supports async functions, so does Clio. However, unlike JavaScript Clio doesn't have an `async` keyword. Simply using an `await` keyword in your function marks it as async. The `await` keyword can be used in flows:

```text
export fn main argv:
  "https://get.geojs.io/v1/ip/geo.json"
    -> await fetch
    -> await .json
    -> console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=export%20fn%20main%20argv%3A%0A%20%20%22https%3A%2F%2Fget.geojs.io%2Fv1%2Fip%2Fgeo.json%22%0A%20%20%20%20-%3E%20await%20fetch%0A%20%20%20%20-%3E%20await%20.json%0A%20%20%20%20-%3E%20console.log)

It can also be used outside flows:

```text
export fn main argv:
  await fetch "https://get.geojs.io/v1/ip/geo.json"
    -> await .json
    -> console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=export%20fn%20main%20argv%3A%0A%20%20await%20fetch%20%22https%3A%2F%2Fget.geojs.io%2Fv1%2Fip%2Fgeo.json%22%0A%20%20%20%20-%3E%20await%20.json%0A%20%20%20%20-%3E%20console.log)

Clio supports await blocks, this is the same as JavaScript's `await Promise.all(...)`:

```text
export fn main argv:
  await:
    fetch "https://get.geojs.io/v1/ip/geo.json"
    fetch "https://get.geojs.io/v1/ip/8.8.8.8.json"
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=export%20fn%20main%20argv%3A%0A%20%20await%3A%0A%20%20%20%20fetch%20%22https%3A%2F%2Fget.geojs.io%2Fv1%2Fip%2Fgeo.json%22%0A%20%20%20%20fetch%20%22https%3A%2F%2Fget.geojs.io%2Fv1%2Fip%2F8.8.8.8.json%22)

You can wrap an await block in `[]` to get the result as an array:

```text
export fn main argv:
  await: [
    fetch "https://get.geojs.io/v1/ip/geo.json"
    fetch "https://get.geojs.io/v1/ip/geo/8.8.8.8.json"
  ]
    -> * await .json
    -> * console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=export%20fn%20main%20argv%3A%0A%20%20await%3A%20%5B%0A%20%20%20%20fetch%20%22https%3A%2F%2Fget.geojs.io%2Fv1%2Fip%2Fgeo.json%22%0A%20%20%20%20fetch%20%22https%3A%2F%2Fget.geojs.io%2Fv1%2Fip%2Fgeo%2F8.8.8.8.json%22%0A%20%20%5D%0A%20%20%20%20-%3E%20*%20await%20.json%0A%20%20%20%20-%3E%20*%20console.log%0A)

Clio also supports `[await]` keyword, which translates to `await Promise.all(...)`:

```text
export fn main argv:
  await: [
    fetch "https://get.geojs.io/v1/ip/geo.json"
    fetch "https://get.geojs.io/v1/ip/geo/8.8.8.8.json"
  ]
    -> * [await] .json
    -> * console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=export%20fn%20main%20argv%3A%0A%20%20await%3A%20%5B%0A%20%20%20%20fetch%20%22https%3A%2F%2Fget.geojs.io%2Fv1%2Fip%2Fgeo.json%22%0A%20%20%20%20fetch%20%22https%3A%2F%2Fget.geojs.io%2Fv1%2Fip%2Fgeo%2F8.8.8.8.json%22%0A%20%20%5D%0A%20%20%20%20-%3E%20*%20%5Bawait%5D%20.json%0A%20%20%20%20-%3E%20*%20console.log)
