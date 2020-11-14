# Dependencies section

Clio dependencies of your project are defined in the `[dependencies]` section of your project manifest. Whenever you run `clio deps add <dependency>`, it will be added to this section. You can also add a dependency by specifying its source location, the name and its version:

```text
[dependencies]
stdlib = "latest"
"hub:greeter" = "latest"
```

A reference to the paths that can be specified as a dependency, see [dependency parser](../../development/dependency_parser.md)

### NPM dependencies

To add npm dependencies, use `[npm_dependencies]` section:

```text
[npm_dependencies]
express = "latest"
passport = "latest"
```
