Decorators
==========

Clio supports function decorators. If you're familiar with the concept of decorators
in Python, you already know their use cases and know how they work. Function decorators,
are functions that take in a function as their last parameter, and return another function.
This has a lot of interesting use cases, and is used by the Clio compiler to add a few
interesting features:

.. playground::
  :height: 700

  fn log fun:
    fn wrapped name:
      result = fun name
      console.log result

  @log
  fn hello name:
    f"Hello {name}"

  export fn main:
    hello "world"

The log function in the above example is a decorator, it takes in a function as its last
parameter, then wraps it in a new function and returns this new function. On line 6,
``@log`` *decorates* the ``hello`` function with the ``log`` function. Click on run
to see what happens.

As said earlier, decorators have lots of interesting use cases, for example, when used
together with the Node.js ``express`` library, the following can be accomplished:

.. playground::
  :height: 400
  :no-interactive:

  import "esm:express"
  app = express ()

  @app.get "/"
  fn hello req res:
    res.send "Hello world"

  export fn main argv:
    app.listen 3000

.. note::
  To run the above example you need to add express to your dependencies:
  ``clio deps add --npm express``

You can also document your functions with ``@describe``:

.. playground::
  :height: 440

  @describe "Adds a and b"
  fn add a b:
    a + b

  export fn main:
    help add

Using the ``help`` function on any function prints the documentation for that function, if it exists.
In addition to that, the ``clio docs`` command can be used to view documentation for the functions
defined in a project:

.. video:: ../_static/videos/clio.docs.mp4
  :autoplay:
  :muted:
  :loop:
