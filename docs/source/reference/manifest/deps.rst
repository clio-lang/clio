Dependencies section
====================

Clio dependencies of your project are defined in the ``[dependencies]``
section of your project manifest. Whenever you run
``clio deps add <dependency>``, it will be added to this section. You
can also add a dependency by specifying its source location, the name
and its version:

.. code-block:: toml

   [dependencies]
   "https://github.com/clio-lang/fib" = "master"

Clio modules are installed from git. To install a dependency, you need to
pass a git url and a tag, commit hash or branch name:

.. code-block:: bash

   clio deps add https://github.com/clio-lang/fib@branch
   clio deps add https://github.com/clio-lang/fib@tag
   clio deps add https://github.com/clio-lang/fib@hash

Multiple versions of a dependency can be installed and used at the same time,
to import a dependency you need to use the tag, commit hash, or branch name
used to install it:

.. playground::
   :no-interactive:

   import "fib@master" as fib
   import "fib@develop" as cuttingEdgeFib


NPM dependencies
----------------

To add npm dependencies, use ``[npm.dependencies]`` section:

.. code-block:: toml

   [npm.dependencies]
   express = "latest"
   passport = "latest"

For dev dependencies use ``[npm.devDependencies]`` section:

.. code-block:: toml

   [npm.dependencies]
   parcel = "next"

