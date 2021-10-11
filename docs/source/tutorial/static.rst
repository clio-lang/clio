Static Typing
=============

Typing in Clio is optional and gradual, you can add type info and enforce it where it
makes sense, and skip adding type information when prototyping, or where it doesn't matter.
Whether you choose to add type info to your code or not, you can always reconsider it.
There is also optional dynamic type checking in Clio, but let us first start with static
typing. To add static type checking to assignments, simply put the expected type before the
name identifier:

.. playground::
  :height: 400

  export fn main:
    Number five = 2 + 3
    console.log five

If you change ``Number`` to ``String`` in the example above, the compiler throws a type error:

.. playground::
  :height: 400

  export fn main:
    String five = 2 + 3
    console.log five

Unlike JavaScript, there is no implicit coercion in Clio. That means something like this is not
valid in Clio:

.. playground::
  :height: 400

  export fn main:
    Number five = 2 + "3"
    console.log five

Functions
---------

Clio makes use of decorators to add static typing to function definitions:

.. playground::
  :height: 600

  @returns Number
  @params Number Number
  fn add a b: a + b

  export fn main:
    Number five = add 2 3
    Number foo = add "2" 3 -- This throws an error
    String foo = add 2 3   -- This throws an error
    
The types defined using decorates are enforced on compile time, the information about the types
is also available on run-time. To enforce run-time checks, simply decorate your function with
``@check``:

.. playground::
  :height: 600

  @check -- adds dynamic type checking to this function
  @returns Number
  @params Number Number
  fn add a b: a + b

  export fn main:
    Number five = add 2 3
    console.log five
