# The backquote!

The backquote symbol prevents an expression from getting executed, it returns a string representation of the expression:

```text
export fn main argv:
  `(2 + 7) -> console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=export%20fn%20main%20argv%3A%0A%20%20%60%282%20%2B%207%29%20-%3E%20console.log)

Will print `"(2 + 7)"` instead of `9`. If needed, it can be passed to the `eval` function:

```text
export fn main argv:
  `(2 + 7) -> eval -> console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=export%20fn%20main%20argv%3A%0A%20%20%60%282%20%2B%207%29%20-%3E%20eval%20-%3E%20console.log)

{% hint style="warning" %}
If you print a backquote expression, it will print the target language representation of the backquote expression \(the compiled version, in case of current Clio version transpiled to JavaScript\) and not the Clio representation.
{% endhint %}

