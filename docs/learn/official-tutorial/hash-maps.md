# Hash maps

Clio supports hash maps. There are several ways to define a hash map, first is defining them in a linear fashion:

```text
export fn main argv:
  # x: 10 y: 16 -> console.log
```

[Try on playground.](https://playground.clio-lang.org/?code=export%20fn%20main%20argv%3A%0A%20%20%23%20x%3A%2010%20y%3A%2016%20-%3E%20console.log)

Second way, is to use idents. Indents also can be used to make nested hash maps:

```text
export fn main argv:
  #
    app:
      version: "1.0.1"
      name: "My App"
    window:
      height: 100
      width: 300
      title: "Hello world!"
  -> console.log
```

[Try on playground.](https://playground.clio-lang.org/?code=export%20fn%20main%20argv%3A%0A%20%20%23%0A%20%20%20%20app%3A%0A%20%20%20%20%20%20version%3A%20%221.0.1%22%0A%20%20%20%20%20%20name%3A%20%22My%20App%22%0A%20%20%20%20window%3A%0A%20%20%20%20%20%20height%3A%20100%0A%20%20%20%20%20%20width%3A%20300%0A%20%20%20%20%20%20title%3A%20%22Hello%20world!%22%0A%20%20-%3E%20console.log)

The third way, is a combination of linear, and indented hash map syntax:

```text
export fn main argv:
  # app:
      version: "1.0.1"
      name: "My App"
    window:
      height: 100
      width: 300
      title: "Hello world!"
  -> console.log
```

[Try on playground.](https://playground.clio-lang.org/?code=export%20fn%20main%20argv%3A%0A%20%20%23%20app%3A%0A%20%20%20%20%20%20version%3A%20%221.0.1%22%0A%20%20%20%20%20%20name%3A%20%22My%20App%22%0A%20%20%20%20window%3A%0A%20%20%20%20%20%20height%3A%20100%0A%20%20%20%20%20%20width%3A%20300%0A%20%20%20%20%20%20title%3A%20%22Hello%20world!%22%0A%20%20-%3E%20console.log)



