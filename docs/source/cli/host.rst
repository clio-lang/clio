clio host
=========

To host a Clio project you can run the following command in the root
directory of your Clio project:

.. code:: bash

   clio host

Command Syntax and Options
--------------------------

.. code:: console

   $ clio host --help

   clio host [config]

   Compile and host Clio file

   Options:
         --version  Show version number                                   [boolean]
         --config   Config file, or a directory to read configs from.
                                                            [string] [default: "."]
         --silent   Mutes messages from the command.                      [boolean]
         --clean    Wipe the build directory before build                 [boolean]
     -h, --help     Show help                                             [boolean]

This command builds the project based on the passed config file, then
hosts the exposed functions.
