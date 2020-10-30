# Introduction

Clio is a new-generation programming language that compiles to JavaScript, but this doesn't mean it's just JavaScript in new clothes. Clio requires its own runtime including but not limited to data types, lazy evaluator, built-in libraries, event emitter, network-based foreign function interface and the remote ecosystem. Clio introduces a unique syntax, way of programming and new programming concepts.

As for syntax, Clio isn't a free-form language, that means spaces have meanings in the language syntax. Clio is a noise-free language, that means most of the common symbols found in other languages are not present in Clio, as an example, functions aren't called by braces in Clio and arguments aren't separated by a comma.

Clio allows to easily chain functions together with flexibility without losing readability, these function calls aren't nested inside each other and they're read and run in same direction as they're written, not from inner to outer. This way of chaining functions is called a flow in Clio, a flow starts with data or data source \(an event listener for example\), functions operate after each other on the data.

Functions are microservices in Clio, they're isolated and free of side-effects, Clio provides tools to host these functions, export reactive data sources and static variables and import and work with them in any other place in any language. With the network-based foreign function interface you'll be able to use most of modules of any other programming language with ease.

This document assumes you have at least a basic programming knowledge and you're familiar with concepts like a variable or a function, but it should be easy for non-programmers to pick up.
