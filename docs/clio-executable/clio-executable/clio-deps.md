# clio deps

## List dependencies

Use `clio deps` to show a Clio project dependencies:

```text
clio deps
~> stdlib: latest
~> rethinkdb: 2.3.3
```

## Add dependencies

You can install from a url \(compressed package\), a git repository \(@version eg. `@1.2.2` is supported\) or from the official Clio repository. For a list of packages that exist in the official repository you can visit the [official package index repo](https://github.com/clio-lang/packages/).

Use `clio deps add` to fetch and install the dependencies.

### Github format

To install from the master branch of a Github repository:

```text
clio deps add github.com/clio-lang/rethinkdb
```

To install from a specific branch of a Github repository:

```text
clio deps add github.com/foo/bar@tagname
```

For example this,

```text
clio deps add github.com/clio-lang/rethinkdb@v2.3.3
```

installs the .zip file listed at [https://github.com/clio-lang/rethinkdb/releases/tag/v2.3.3](https://github.com/clio-lang/rethinkdb/releases/tag/v2.3.3) \([https://github.com/clio-lang/rethinkdb/archive/v2.3.3.zip](https://github.com/clio-lang/rethinkdb/archive/v2.3.3.zip)\).

### URL format

To install from a generic URL:

```text
clio deps add https://a-domain.com/path/to/content.zip
```

To install from a specific Github tag URL:

```text
clio deps add https://github.com/clio-lang/rethinkdb@v2.3.3.zip
```

### Package id

If a package is listed in the [Clio packages repository](https://github.com/clio-lang/packages), you can just use its name:

```text
clio deps add package_name
```

You can choose to install a particular tag using this syntax:

```text
clio deps add package_name@tag_id
```

For example to install [greeter](https://github.com/clio-lang/packages/blob/master/packages/greeter.json):

```text
clio deps add greeter
```

### Npm package

If you want to add an npm package, you can pass `--npm` flag to this command:

```text
clio deps add --npm express
```

## Download dependencies

To fetch all of the dependencies listed in the package config file:

```text
clio deps get
```
