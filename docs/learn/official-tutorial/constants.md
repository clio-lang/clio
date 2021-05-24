# Constants

There are no variables in Clio, instead we have constants. There are two ways to declare them:

```text
export fn main argv:
  "Hello" => hello
  world = "world"
  console.log hello + " " + world + "!"
```

Run this in the [playground](https://clio-playground-pouyae.vercel.app/?code=export%20fn%20main%20argv%3A%0A%20%20%22Hello%22%20%3D%3E%20hello%0A%20%20world%20%3D%20%22world%22%0A%20%20console.log%20hello%20%2B%20%22%20%22%20%2B%20world%20%2B%20%22!%22).

In the above piece of code we put `"Hello"` in `hello`, and assign `"world"` to `world` . You can probably guess what the last line does. Constants translate to JavaScript `const` and they cannot be reassigned.

The `=>` syntax for defining a constant is very useful if used in a chain or a flow, a concept you will learn about soon in the next few chapters.

