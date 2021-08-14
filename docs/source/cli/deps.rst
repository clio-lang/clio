clio deps
=========

List dependencies
-----------------

Use ``clio deps`` or ``clio deps show`` to show a Clio project dependencies:

.. code:: console

   $ clio deps
   
   ~> https://github.com/clio-lang/fib: master

Command Syntax and Options
--------------------------

.. code:: console

   $ clio deps --help

   Manage clio dependencies

   Commands:
   clio deps add <source> [project]          Add a new dependency
   [options]
   clio deps get [project]                   Download every dependency listed in
                                             the package config file
   clio deps show [project]                  Show a list of dependencies for the
                                             project                    [default]

   Options:
         --version       Show version number                            [boolean]
         --project       Project root directory, where your clio.toml file is.
                                                          [string] [default: "."]
   -h, --help, --help  Show help                                        [boolean]


Add dependencies
----------------

You can install from a git url and a git tag, commit hash or branch name.
Check `Clio modules`_ section for more info.

Use ``clio deps add`` to fetch and install the dependencies:

.. code:: bash

   clio deps add https://github.com/clio-lang/fib@master

Npm packages
~~~~~~~~~~~~

If you want to add an npm package, you can pass ``--npm`` flag to this
command:

.. code:: bash

   clio deps add --npm express

You can also pass the ``--dev`` flag to install npm dev dependencies:

.. code:: bash

   clio deps add --npm --dev parcel

Download dependencies
---------------------

To fetch all of the dependencies listed in the package config file:

.. code:: bash

   clio deps get

.. _Clio modules: ../modules/clio.html
