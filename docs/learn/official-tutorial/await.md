# Async / Await

JavaScript supports async functions, so does Clio. However, unlike JavaScript Clio doesn't require an `async` keyword. Simply using an `await` keyword in your function marks it as async. The `await` keyword can be used in flows:

```text
export fn main argv:
  "https://get.geojs.io/v1/ip/geo.json"
    -> await fetch
    -> await .json
    -> console.log
```

It can also be used outside flows:

```text
export fn main argv:
  await fetch "https://get.geojs.io/v1/ip/geo.json"
    -> await .json
    -> console.log
```

Clio supports await blocks, this is the same as JavaScript's `await Promise.all(...)`:

```text
export fn main argv:
  await:
    fetch "https://get.geojs.io/v1/ip/geo.json"
    fetch "https://get.geojs.io/v1/ip/8.8.8.8.json"
```

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

Clio also supports `[await]` keyword, which also translates to `await Promise.all(...)`:

```text
export fn main argv:
  await: [
    fetch "https://get.geojs.io/v1/ip/geo.json"
    fetch "https://get.geojs.io/v1/ip/geo/8.8.8.8.json"
  ] 
    -> * [await] .json
    -> * console.log
```