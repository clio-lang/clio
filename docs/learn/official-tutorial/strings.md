# Strings

Clio supports Python style string formatting and template literals. The syntax is very much similar to the one of Python's:

```text
fn hello who:
  console.log f"Hello {who}!"

export fn main argv:
  hello "visitor"
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=fn%20hello%20who%3A%0A%20%20console.log%20f%22Hello%20%7Bwho%7D!%22%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20hello%20%22visitor%22%0A)

You can also use custom functions, for example:

```text
fn upper str:
  str -> * .toUpperCase -> .join

export fn main argv:
  console.log upper"hello!"
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=fn%20upper%20str%3A%0A%20%20str%20-%3E%20*%20.toUpperCase%20-%3E%20.join%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20console.log%20upper%22hello!%22%0A)

Customer tags and functions for string formatting follow the same convention as JavaScript. Visit [MDN web docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) to learn more about them.

{% hint style="warning" %}
Support for template literals isn't really polished yet.
{% endhint %}
