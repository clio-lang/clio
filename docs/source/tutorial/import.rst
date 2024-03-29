Importing
=========

.. warning:: Examples on this page won't run in the playground.

When making a big project, you don't want to store everything in one file, or in one directory. You can break your big code into smaller pieces, store them in different files, in different locations, then import and use them in other files in your project:

.. tabbed:: main.clio

  .. playground::
    :height: 360
    :no-interactive:

    import "./greetings"

    export fn main argv:
      "World" -> greetings.hello

.. tabbed:: greetings.clio

  .. playground::
    :height: 360
    :no-interactive:

    export fn hello arg:
      console.log "Hello" arg


.. note::
    Clio supports absolute imports from the root of the project.
    Instead of writing import statements such as ``import "../../../lib/xyz"``
    you can just do ``import "/lib/xyz"``.

Clio will guess the module name based on its path.
The default strategy is to get the file name, remove extensions,
remove any version number, and convert kebab case to pascalCase (replace dashes).
If you want to rename the module, you can do:

.. tabbed:: main.clio

  .. playground::
    :height: 360
    :no-interactive:

    import "./greetings" as g
    -- OR
    from "./greetings" import * as g

    export fn main argv:
      "World" -> g.hello

.. tabbed:: greetings.clio

  .. playground::
    :height: 360
    :no-interactive:

    export fn hello arg:
      console.log "Hello" arg

If you only want to import only one function from the module, you can do:

.. tabbed:: main.clio

  .. playground::
    :height: 360
    :no-interactive:

    from "./greetings" import hello

    export fn main argv:
      "World" -> hello

.. tabbed:: greetings.clio

  .. playground::
    :height: 360
    :no-interactive:

    export fn hello arg:
      console.log "Hello" arg

If you want to rename the imported function, you can do:

.. tabbed:: main.clio

  .. playground::
    :height: 360
    :no-interactive:

    from "./greetings" import hello as my_function

    export fn main argv:
      "World" -> my_function

.. tabbed:: greetings.clio

  .. playground::
    :height: 360
    :no-interactive:

    export fn hello arg:
      console.log "Hello" arg

To import several functions, you can do:

.. tabbed:: main.clio

  .. playground::
    :height: 360
    :no-interactive:

    from "./greetings" import hello bye

    export fn main argv:
      "World" -> hello

.. tabbed:: greetings.clio

  .. playground::
    :height: 500
    :no-interactive:

    export fn hello arg:
      console.log "Hello" arg

    export fn bye arg:
      console.log "Bye" arg

You can also use indents to format your imports:

.. tabbed:: main.clio

  .. playground::
    :height: 500
    :no-interactive:

    from "./greetings" import
      hello
      bye

    export fn main argv:
      "World" -> hello

.. tabbed:: greetings.clio

  .. playground::
    :height: 400
    :no-interactive:

    export fn hello arg:
      console.log "Hello" arg

    export fn bye arg:
      console.log "Bye" arg

To rename multiple imports, do:

.. tabbed:: main.clio

  .. playground::
    :height: 500
    :no-interactive:

    from "./greetings" import
      hello as my_function
      bye

    export fn main argv:
      "World" -> my_function

.. tabbed:: greetings.clio

  .. playground::
    :height: 400
    :no-interactive:

    export fn hello arg:
      console.log "Hello" arg

    export fn bye arg:
      console.log "Bye" arg

To import a function, and rest of the module in a separate namespace do:

.. tabbed:: main.clio

  .. playground::
    :height: 500
    :no-interactive:

    from "./greetings" import
      bye
      * as greetings

    export fn main argv:
      "World" -> greetings.hello

.. tabbed:: greetings.clio

  .. playground::
    :height: 400
    :no-interactive:

    export fn hello arg:
      console.log "Hello" arg

    export fn bye arg:
      console.log "Bye" arg

Constants can be exported as well:

.. playground::
  :height: 400
  :no-interactive:
  
  42 => export answer
  export pi = 3.14
  
  foo = "foo"
  export foo
