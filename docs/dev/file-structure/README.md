# File Structure

## Packages

Clio uses a single-repository approach to handle consistent releases. We use [Lerna](https://lerna.js.org/) in order to manage packages in the main repository. All packages live in the `packages/` directory at the root of the repository.

### Tests

Tests are part of each package. They live in a `./tests/` directory relative to the file being tested. To give an example:

```
- tests/
    - foo.test.js
- foo.js
- package.json
```

## Documentation

All of the documentation for the Clio Programming Language lives in the `docs/` directory at the root of the repository. In order to keep our docs consistent, we ensure that sufficient documentation is provided within each pull request.
