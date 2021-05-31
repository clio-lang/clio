# Clio build

This command can be used to build a Clio project. Simply run this command in the root of your project, where `clio.toml` file exists:

```text
clio build
```

## Command Syntax and Options

```text
clio build [config]

Build a Clio project

Options:
      --version           Show version number                          [boolean]
      --config            Config file, or a directory to read configs from.
                                                         [string] [default: "."]
      --skip-bundle       Does not produces a bundle for browsers.     [boolean]
      --skip-npm-install  Skips npm install. Useful for tests.         [boolean]
      --silent            Mutes messages from the command.             [boolean]
      --clean             Wipe the build directory before build        [boolean]
  -h, --help              Show help                                    [boolean]

```



