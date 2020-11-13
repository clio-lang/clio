# build section

The `[build]` section of the project manifest provides options regarding the build process of the project.

```text
[build]
directory = "build"
target = "myTarget"
```

## The `directory` field

This field specifies the relative path of the output directory of your builds. By default, directory `build` will be used.

## The `target` field

The `target` field defines the target directory the project will be built to. When building a project, it will be put in `<project-root>/<build-directory>/<target-directory>`. To give an example for a custom target path:

```text
[build]
directory = "out"
target = "optimized"
```

When building the project with this configuration, the output will be put in `<root>/out/optimized/`.

