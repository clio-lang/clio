Hash maps
=========

Clio supports hash maps. There are several ways to define a hash map,
first is defining them in a linear fashion:

.. playground::
  :height: 320

  export fn main argv:
    # x: 10 y: 16 -> console.log


Second way, is to use idents. Indents also can be used to make nested
hash maps:

.. playground::
  :height: 600

  export fn main argv:
    #
      app:
        version: "1.0.1"
        name: "My App"
      window:
        height: 100
        width: 300
        title: "Hello world!"
    -> console.log


The third way, is a combination of linear, and indented hash map syntax:

.. playground::
  :height: 600

  export fn main argv:
    # app:
        version: "1.0.1"
        name: "My App"
      window:
        height: 100
        width: 300
        title: "Hello world!"
    -> console.log
