clio run
========

To run a Clio project, you can run the following command in the root
directory of your Clio project:

.. code:: bash

   clio run

Command Syntax and Options
--------------------------

.. code:: console

   $ clio run --help

   clio run [config]

   Compile and run Clio file

   Options:
         --version  Show version number                                   [boolean]
         --config   Config file, or a directory to read configs from.
                                                            [string] [default: "."]
         --silent   Mutes messages from the command.                      [boolean]
         --clean    Wipe the build directory before build                 [boolean]
     -h, --help     Show help                                             [boolean]

This command builds the project based on the passed config file, then
runs it.
