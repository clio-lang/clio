Dependencies section
====================

Clio dependencies of your project are defined in the ``[dependencies]``
section of your project manifest. Whenever you run
``clio deps add <dependency>``, it will be added to this section. You
can also add a dependency by specifying its source location, the name
and its version:

.. code-block:: toml

   [dependencies]
   stdlib = "latest"
   "hub:greeter" = "latest"

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

