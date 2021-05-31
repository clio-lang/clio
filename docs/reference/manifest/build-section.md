# Build section

The `[build]` section of the project manifest provides options regarding the build process of the project.

```text
[build]
source = "src"
destination = "build"
target = "js"
```

## The `destination` field

This field specifies the relative path of the output directory of your builds. By default, directory `build` will be used.

## The `source` field

This field specifies the relative path of the input directory of your builds. By default, directory `src` will be used.

## The `target` field

The `target` field defines which code generator will be used to build the source code. Currently only "js" target is supported, "llvm" or "wasm" targets are planned for future releases.

