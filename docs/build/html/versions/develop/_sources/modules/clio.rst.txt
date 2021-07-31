Clio modules
============

Any exported function in any ``.clio`` file can be imported in any other
Clio file.

.. tabbed:: my_module.clio

  .. playground::
    :height: 360

    export fn hello name:
      'hello' name -> console.log


The above example is a simple Clio module and can be imported and used
like this:

.. playground::
  :height: 400

   import hello from "my_module"

   export fn main argv:
     'world' -> hello

In Clio, imports are relative and by path, there is no support for
absolute imports. Clio recognises the following import path formats:

.. playground::
  :height: 560

  import module
  import "./module"
  import "../module"
  import "dir/module"
  import "./dir/module"
  import "../dir/module"

Including ``.clio`` for file name is optional, the above example is the
same as the following:

.. playground::
  :height: 560

  import "module.clio"
  import "./module.clio"
  import "../module.clio"
  import "dir/module.clio"
  import "./dir/module.clio"
  import "../dir/module.clio"

External Clio Dependencies
--------------------------

To install a package from the Clio package registry, you can run:

.. code:: bash

  clio deps add <package-name>

this will add the package as a dependency in your manifest, fetch the
package and store it inside the ``clio_env`` directory at the root of
your project. If you want to fetch the packages listed in your project
manifest file, you can run:

.. code:: bash

  clio deps get

When the project is compiled, the dependencies inside your ``clio_env``
directory will be compiled and linked to your build.
