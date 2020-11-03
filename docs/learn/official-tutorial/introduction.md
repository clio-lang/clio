# Introduction

{% hint style="danger" %}
New Clio version isn't production ready yet, it is not even in beta stage.
Things might break or not work as expected, if you encounter any issues like that please let us know so we can fix them as soon as we can.
{% endhint %}

Clio is a new programming language that compiles to JavaScript, althought Clio tries to stay as close as possible to JavaScript, mainly for performance reasons, it doesn't mean Clio just JavaScript in new clothes. Clio requires its own runtime and standrd libraries, including but not limited to data types, lazy evaluator, built-in libraries, event emitter, network-based foreign function interface and the remote ecosystem. Clio introduces a unique syntax, way of programming and new programming concepts.

As for syntax, Clio isn't a free-form language, that means spaces have meanings in the language syntax. Clio is a noise-free language, that means most of the common symbols found in other languages are not present in Clio, as an example, functions aren't called by braces in Clio and arguments aren't separated by a comma.

Clio allows to easily chain functions together with flexibility without losing readability, these function calls aren't nested inside each other and they're read and run in same direction as they're written, not from inner to outer. This way of chaining functions is called a flow in Clio, a flow starts with data or data source \(an event listener for example\), functions operate after one another on the data.

All functions have a parallel version in Clio, they're isolated but not free of side-effects, Clio provides tools to host these functions, export them, import and work with them in any other place in any language. With the network-based foreign function interface you'll be able to use most of the modules of any other programming language with ease.

This document assumes you have at least a basic programming knowledge and you're familiar with concepts like a variable or a function, but it should also be easy for non-programmers to pick up.

This article assumes you have installed Clio and you have a working Clio installation. If not, please follow the install instructions before going any further in this document.