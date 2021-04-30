# Constants

In Clio, unlike other languages, we don't write x equals y, instead we put y in x:

```text
export fn main argv:
  "Hello world!" => hello
  console.log hello
```

In the above piece of code we put `"Hello world!"` in `hello`, and then we print `hello` in the next line. Constants translate to JavaScript `const` and they cannot be reassigned.

