Lists
=====

Lists define a list (or an Array) of items of a specific type, for example, a list of ``Points``:

.. playground::
  :height: 240
  :no-interactive:

  type Point: x y
  list Points: Point

Lists are used for static (and dynamic) type checking:

.. playground::
  :height: 700

  type Point: x y
  list Points: Point

  export fn main:
    Points points = [
      (Point 10 10)
      (Point 20 20)
    ]

    -- This will throw a type error:
    Points foo = ["Not a point"]
