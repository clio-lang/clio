# Comparison

Unlike JavaScript, multiple comparisons can be made at the same time, for example:

```text
export fn main argv:
  10 > 4 == 4 < 10 -> console.log
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=export%20fn%20main%20argv%3A%0A%20%2010%20%3E%204%20%3D%204%20%3C%2010%20-%3E%20console.log)

{% hint style="warning" %}
Currently Clio compiled `==` to `==` but this will be changed to `===` in future releases.
{% endhint %}



