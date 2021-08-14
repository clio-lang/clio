Change Log
==========

v0.10.0
-------

- Changed import syntax from ``import abc from "module"`` to ``from "module" import abc``.

  This allows us to add better IntelliSense / Auto-completion support,
  and allows more flexibility on the import syntax.

- Clio modules are now installed in ``.clio/modules``. It's now required to specity the
  module version when importing. Installing and using multiple versions of the same module
  is now possible. Dependencies aren't installed in nested subdirectories anymore.

- A namespace prefix added to hosted functions. This is to ensure modules register their
  rpc functions in their own namespace. It's now required to specify a namespace when importing
  functions over network.

- Imports are now resolved on complie time. JavaScript bundlers like Parcel, Webpack, Rollup and
  others know and recognize ``esm`` and ``cjs`` import systems, to keep Clio compatible with these
  tools we have to use ``esm`` and ``cjs`` import methods and not a custom import function. This
  makes module resolve impossible on runtime.

- Added tail recursive call optimization.
