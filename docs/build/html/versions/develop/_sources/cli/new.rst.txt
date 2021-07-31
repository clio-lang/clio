clio new
========

``clio new <project-name>`` is the quickest way to get started with
Clio!

Use it to generate a new project contained in a subdirectory.

.. code:: console

   $ clio new x7

   Getting 'stdlib' from the Clio packages repository (https://github.com/clio-lang/packages)
   Downloading stdlib@latest...
   Info: Added Clio dependencies
   Info: Initialized new git repository.
   Info: Initialization Complete!
   Success: Run 'cd x7' to open, then 'clio run index.clio' to run the project!

Command Syntax and Options
--------------------------

.. code:: console

   $ clio new --help

   clio new <project>

   Create a new Clio project

   Options:
         --version   Show version number                                  [boolean]
         --project   name of the project                                   [string]
         --target    Choose a target for compilation (eg. JavaScript)
                                                           [string] [default: "js"]
         --template  Template to use for scaffolding     [string] [default: "node"]
     -h, --help      Show help                                            [boolean]

Templates
---------

Clio uses templates for creating the projects. Official templates are
“`web`_” and “`node`_”. The “web” template is setup to bundle your
project for the web, using `Parcel`_ bundler. You can use any git
repository as a template, just pass the clone address of the git to the
``--template`` flag (in form of ``https://address/of/git/repo`` or
``git@host:repo`` ).

.. _web: https://github.com/clio-lang/template-web
.. _node: https://github.com/clio-lang/template-node
.. _Parcel: https://parceljs.org/
