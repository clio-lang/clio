Comparison
==========

Unlike JavaScript, multiple comparisons can be made at the same time, for example:

.. playground::
  :height: 320

  export fn main argv:
    10 > 4 == 4 < 10 -> console.log

.. note:: Clio compiles ``==`` to JavaScript's ``===``
