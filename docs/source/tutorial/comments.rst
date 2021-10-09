Comments
========

Clio supports line comments only:

.. playground::
  :height: 400

  -- This is a line comment

  foo = "foo" -- This is another comment

The comments are stripped out by the lexer,
they don't appear in the syntax tree, nor in the generated code.