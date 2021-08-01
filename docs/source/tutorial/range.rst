Range
=====

Clio supports range literals. To define them, you can write:

.. playground::
  :height: 180
  :no-interactive:

  export fn main argv:
    start..end by step

with ``start``, ``end`` and ``step`` being optional:

.. playground::
  :height: 400
  
  export fn main argv:
    0..4 -> .toArray -> console.log
    0..10 by 2 -> .toArray -> console.log
    ..4 -> .toArray -> console.log

.. warning::
  Ranges are lazy, you can define infinite
  ranges and map functions to them, however a proper ``take`` function
  isn’t implemented yet.
