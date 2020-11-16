# Strings

Clio supports Python style string formatting and template literals. The syntax is very much similar to the one of Python's:

```text
fn hello who:
  console.log f"Hello {who}!"

export fn main argv:
  hello "visitor"
```

You can also use custom functions, for example:

```text
fn upper str:
  str -> * .toUpperCase -> .join

export fn main argv:
  console.log upper"hello!"
```

Customer tags and functions for string formatting follow the same convention as JavaScript. Visit [MDN web docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) to learn more about them.

{% hint style="warning" %}
Support for template literals isn't really polished yet.
{% endhint %}

