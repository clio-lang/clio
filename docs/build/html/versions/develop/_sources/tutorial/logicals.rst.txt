Logicals
========

Clio supports ``and``, ``or`` and ``not`` keywords:

.. playground::
  :height: 760
  
  fn isEven n:
    n % 2 == 0 and not n == 0

  fn isOdd n:
    not (isEven n)

  export fn main argv:
    isEven 10 -> console.log
    isOdd 10 -> console.log

    (isOdd 10) or (isEven 10) -> console.log
    (isOdd 10) or not (isEven 10) -> console.log

