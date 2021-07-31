Install
=======

Install via NPM
---------------

To install the Clio programming language, you’ll need Node.js and NPM.
After installing Node and NPM, you can install Clio by running:

.. code-block:: shell

   npm i -g clio

Check your installation by running ``clio`` in your local shell. You’re
good to go!

.. note:: Your Node version needs to be at least v14.14.0.

Install via Arch User Repository
--------------------------------

If you are using an Arch-based linux distribution, you might consider
installing Clio via the Arch User Repository (AUR). You can get more
information about the ``clio-lang`` package here:

https://aur.archlinux.org/packages/clio-lang

Bleeding Edge Installation
--------------------------

Clio is in active development and installation is only recommended for
testing, early adopting and development so it is recommended to install
from git before we reach a stable version one release.

To install from git, you’ll need Node.js, NPM and git. You need to clone
the repository:

.. code-block:: shell
   
   git clone https://github.com/clio-lang/clio

Then ``cd`` to the project directory:

.. code-block:: shell

   cd clio

Now you need to install dependencies, to do that run:

.. code-block:: shell

   npm install

Now you need to link the ``clio`` executable:

.. code-block:: shell

   npm link

If you are planning to make changes to the local clio installation, you
will need to specify its location in the ``CLIOPATH`` environment
variable. This ensures, that local clio packages will be used when
building a project.

Setting CLIOPATH on MacOS/Linux
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Add this line to your ``.bashrc`` file:

.. code-block:: shell

   export CLIOPATH=<path-to-clio-installation>

Setting CLIOPATH on Windows
~~~~~~~~~~~~~~~~~~~~~~~~~~~

TBD
