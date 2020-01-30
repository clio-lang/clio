# Browser

Imports work on browser too. Browser imports are also relative and both JavaScript and Clio imports are supported.

Please note there is no `require` function in browser and because of limitations of browsers \(for example file access limitations\) some JavaScript or Clio modules will not work on the browser.

The default location for `clio_environment` is the value of `window.location.origin`, this can be overridden by setting `window.clio.__basedir` after loading the Clio run-time library and before calling the `clio.process_scripts()` function.

