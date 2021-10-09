Types
=====

Clio has basic support for custom types:

.. playground::
  :height: 440

  type Point: x y

  export fn main:
    point = Point 42 16
    console.log point
    console.log point.x point.y

Static typing can be applied to custom type properties:

.. playground::
  :height: 600

  type Point:
    Number x
    Number y

  export fn main:
    point = Point 42 16
    console.log point
    console.log point.x point.y

Types can extend on another type:

.. playground::
  :height: 600

  type Computer:
    Number memory

  type Robot is Computer:
    String name

  export fn main:
    robot = Robot "R2D2" 1024
    console.log robot
