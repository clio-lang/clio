# Modules

You can write your code in separate files and import them in another file, or you can use libraries written by other programmers. Clio supports multiple ways to import code. 

### Clio dependencies

Clio dependencies are hosted in the \[Clio Package Registry\]\([https://github.com/clio-lang/packages](https://github.com/clio-lang/packages)\). You can add Clio dependencies to your project by using the following command:

```text
clio deps add <dependency>
```

So if you want to add the package `greeter`, you would run `clio deps add greeter`. This checks the Clio package registry for a matching package, adds it to your [Project Manifest File](../../reference/manifest/) and downloads it to the`clio_env` directory, where all of your project dependencies live.

### Other dependencies

You can add any ZIP archive as a dependency the following way:

```text
clio deps add https://github.com/clio-lang/answer/archive/v0.1.0.tar.gz
```

Then in your code, you can import this package:

```text
import answer from "answer-0.1.0/answer"
-- or
import "answer-0.1.0/answer"
```

To import files from a relative path you can write:

```text
import module               -- this will import ./module.clio, if not found will try virtual env
import "./module.clio"      -- this will import ./module, will not try virtual env if not found
import "../module"          -- if this fails, it will not try virtual env
import "../module.js"       -- if this fails, it will not try virtual env
```

Imports work on browser too. Clio recognizes `exports` and `module.exports` in js files. To write a js module and export some variable you can do:

```text
exports.answer = 42;
// or
module.exports.answer = () => 42;
```

