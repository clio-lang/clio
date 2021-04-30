# Anonymous functions

Clio has limited support for anonymous functions. The latest alpha version of Clio supports anonymous functions wrapped in parenthesis and in flows, with only one parameter. Here's how you can define and use anonymous functions:

```text
export fn main argv:
  [1 2 3]
    -> * (@n * 2)
    -> * (console.log @n)
```

[Run on playground.](https://clio-playground.pouyae.vercel.app/?code=export%20fn%20main%20argv%3A%0A%20%20%5B1%202%203%5D%0A%20%20%20%20-%3E%20*%20n%3A%20n%20*%202%0A%20%20%20%20-%3E%20*%20n%3A%20console.log%20n)

You can also pass an anonymous function to another function:

```text
export fn main argv:
  [1 2 3 4 5 6]
    -> .filter (@n > 2)
    -> console.log
```

[Run on playground.](https://clio-playground.pouyae.vercel.app/?code=export%20fn%20main%20argv%3A%0A%20%20%5B1%202%203%204%205%206%5D%0A%20%20%20%20-%3E%20.filter%20%28n%3A%20n%20%3E%202%29%0A%20%20%20%20-%3E%20console.log)

Please note that anonymous function parameters are implicit in Clio.

