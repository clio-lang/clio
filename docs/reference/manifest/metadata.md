# Metadata

Meta-information about the project can be specified in the top-level scope of the manifest. As of the current version of clio, these fields do not serve a specific use case, besides providing users of your project with general information.

```text
title = "hello-world"
description = "A short description about the project"
version = "0.1.0"
license = "MIT"
main = "src/main.clio"
authors = [ "Foo Bar <foo@example.com>" ]
keywords = ""
```

## The `title` field

The title field declares the name of the project. You are free to add any text in this field, however we suggest keeping the title short and rememberable. You should also avoid spaces in this field, if you plan to release the project to a package manager in the future.

## The `description` field

A short description about the project. It can be of any length.

## The `version` field

This field specifies the version of the project. Clio advocates [Semantic Versioning](https://semver.org/), so make sure you follow some basic rules:

- Before you reach 1.0.0, anything goes, but if you make breaking changes, increment the minor version.
- After 1.0.0, only make breaking changes when you increment the major version. Don’t break the build.
- After 1.0.0, don’t add any new public API in patch-level versions. Always increment the minor version if you add any new functions or anything else.
- Use version numbers with three numeric parts such as 1.0.0 rather than 1.0.

## The `license` field

This is an SPDX 2.1 license expression for this package. To keep projects uniform, we invite you to stick to a license that is listed on the [SPDX License List](https://spdx.org/licenses/).

## The `main` field

This field specifies the relative location to the entry file of the project. By default, `src/main.clio` is used.

## The `authors` field

This field credits the authors of the project. It's an array of any number of strings. You are free to use any format you like. A conventional notation is the authors name, followed by the email in angle brackets \(`"Foo Bar <foo@example.com>"`\).

## The `keywords` field

This field should include some keywords, that are associated with the project, separated by a comma: `"Web, Server, HTTP"`
