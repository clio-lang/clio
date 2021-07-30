clio deps
=========

List dependencies
-----------------

Use ``clio deps`` to show a Clio project dependencies:

.. code:: console

   $ clio deps
   
   ~> stdlib: latest
   ~> rethinkdb: 2.3.3

Command Syntax and Options
--------------------------

.. code:: console

   $ clio deps --help

   clio deps

   Manage clio dependencies

   Commands:
     clio deps add <source> [config]           Add a new dependency
     [options]
     clio deps get [config]                    Download every dependency listed in
                                               the package config file

   Options:
         --version       Show version number                              [boolean]
     -h, --help, --help  Show help                                        [boolean]

Add dependencies
----------------

You can install from a url (compressed package), a git repository
(@version eg. ``@1.2.2`` is supported) or from the official Clio
repository. For a list of packages that exist in the official repository
you can visit the `official package index repo`_.

Use ``clio deps add`` to fetch and install the dependencies.

Github format
~~~~~~~~~~~~~

To install from the master branch of a Github repository:

.. code:: bash

   clio deps add github.com/clio-lang/rethinkdb

To install from a specific branch of a Github repository:

.. code:: bash

   clio deps add github.com/foo/bar@tagname

For example this,

.. code:: bash

   clio deps add github.com/clio-lang/rethinkdb@v2.3.3

installs the .zip file listed at
https://github.com/clio-lang/rethinkdb/releases/tag/v2.3.3
(https://github.com/clio-lang/rethinkdb/archive/v2.3.3.zip).

URL format
~~~~~~~~~~

To install from a generic URL:

.. code:: bash

   clio deps add https://a-domain.com/path/to/content.zip

To install from a specific Github tag URL:

.. code:: bash

   clio deps add https://github.com/clio-lang/rethinkdb@v2.3.3.zip

Package id
~~~~~~~~~~

If a package is listed in the `Clio packages repository`_, you can just
use its name:

.. code:: bash

   clio deps add package_name

You can choose to install a particular tag using this syntax:

.. code:: bash

   clio deps add package_name@tag_id

For example to install `greeter`_:

.. code:: bash

   clio deps add greeter

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

.. _official package index repo: https://github.com/clio-lang/packages/
.. _Clio packages repository: https://github.com/clio-lang/packages
.. _greeter: https://github.com/clio-lang/packages/blob/master/packages/greeter.json
