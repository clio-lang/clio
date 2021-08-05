Microsoft Edge
==============

The Microsoft Edge browser support sourcemaps out of the box and they recognize
``.clio`` files without a problem. To debug a Clio web app using Microsoft Edge head
over to the web app, open the `Edge developer tools`_, then select the Sources tab.

On the left side of the Sources tab you can see a list of the source files used in
your web app, you can click on any of the ``.clio`` files there to reveal its content.
You can set breakpoints in the Clio files and debug them, just as you would normally do
with the JavaScript files.

The value of the local variables are displayed inline and also on the right pane of
the Sources tab. On the right pane, you can find more useful information that can help
you debug your app. For more information you can visit the official Microsoft Edge docs_.

.. figure:: ../_static/images/edge.debug.png

  Debugging Clio using Edge DevTools

.. _`Edge developer tools`: https://docs.microsoft.com/en-us/microsoft-edge/devtools-guide-chromium/open
.. _docs: https://docs.microsoft.com/en-us/microsoft-edge/devtools-guide-chromium/javascript