Clio modules
============

Any exported function in any ``.clio`` file can be imported in any other
Clio file.

.. tabbed:: my_module.clio

  .. playground::
    :height: 360
    :no-interactive:

    export fn hello name:
      'hello' name -> console.log


The above example is a simple Clio module and can be imported and used
like this:

.. playground::
  :height: 400
  :no-interactive:

   import hello from "./my_module"

   export fn main argv:
     'world' -> hello

In Clio, imports are relative and by path, there is no support for
absolute imports. Clio recognises the following import path formats:

.. playground::
  :height: 560
  :no-interactive:

  import "module"
  import "./module"
  import "../module"
  import "dir/module"
  import "./dir/module"
  import "../dir/module"

Including ``.clio`` for file name is optional, the above example is the
same as the following:

.. playground::
  :height: 560
  :no-interactive:

  import "module.clio"
  import "./module.clio"
  import "../module.clio"
  import "dir/module.clio"
  import "./dir/module.clio"
  import "../dir/module.clio"

You can also import a directory, if there is a ``main.clio`` file in it:

.. playground::
  :height: 560
  :no-interactive:

  import "./directory"
  -- is the same as:
  import "./directory/main.clio"


External Clio Dependencies
--------------------------

To install a package from the Clio package registry, you can run:

.. code:: bash

  clio deps add <package-name>

this will add the package as a dependency in your manifest, fetch the
package and store it inside the ``.clio/modules`` directory at the root of
your project. If you want to fetch the packages listed in your project
manifest file, you can run:

.. code:: bash

  clio deps get

When the project is compiled, the dependencies inside your ``.clio/modules``
directory will be compiled and linked to your build.

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
