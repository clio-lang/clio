Clio build
==========

This command can be used to build a Clio project. Simply run this
command in the root of your project, where ``clio.toml`` file exists:

.. code:: bash

  clio build

Command Syntax and Options
--------------------------

.. code:: console

  $ clio build --help

  clio build [project]

  Build a Clio project

  Options:
        --version           Show version number                          [boolean]
        --project           Project root directory, where your clio.toml file is.
                                                           [string] [default: "."]
        --skip-bundle       Does not produces a bundle for browsers.     [boolean]
        --skip-npm-install  Skips npm install. Useful for tests.         [boolean]
        --silent            Mutes messages from the command.             [boolean]
        --clean             Wipe the build directory before build        [boolean]
    -h, --help              Show help                                    [boolean]

