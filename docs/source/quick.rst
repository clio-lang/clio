Quick Start
===========

Use Clio’s integrated CLI to bootstrap a new project. To do so, run:

.. code:: bash

   clio new hello

Change into the directory using ``cd hello`` and run the automatically
generated ``index.clio`` file with ``clio run``. How does Clio know
which file to run? Take a look at ``clio.toml``. The field ``main``
specifies the entry point of your application. You can also specify
other fields such as information about the author, the version of the
project and much more. To list all available commands of Clio, simply
run ``clio`` in your shell.
