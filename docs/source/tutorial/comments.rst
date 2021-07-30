Comments
========

Clio supports line comments, block comments, and nested block comments:

.. playground::
  :height: 440

  -- This is a line comment

  +-
    This one is a block comment
    +- This is another, nested in the previous one -+
  -+

If you a function follows a block comment, that comment will be considered
the documentation for the function:

.. playground::
  :height: 740

  +-
    @name fib
    @params {Number} n
    @desctiption Calculates the nth Fibonacci number
  -+
  fn fib n:
    if n < 2: n
    else: (fib n - 1)
        + (fib n - 2)
  
  export fn main:
    doc fib

You can also use the ``clio docs`` command to access the documentation for all
Clio functions in the current working directory:

.. video:: /_static/videos/clio.docs.mp4
  :loop:
  :muted:
  :autoplay:
  :controls:
