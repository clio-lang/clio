![Clio Logo](https://github.com/clio-lang/media/blob/master/logo-128x128.png)

# Clio

Clio is a pure functional lazy-evaluated programming language targeting decentralized and distributed systems. It is made to take advantage of multiple CPUs and CPU cores (parallelism) by default, to run on clusters and on the cloud easily.

Clio compiles to JavaScript. This makes Clio fast, easy to port and easy to extend. It gives Clio a free JIT compiler, a powerful VM and access to lots of existing libraries. It enables Clio to run in the browser and on servers, and anywhere JavaScript can run.

![Clio Logo](https://github.com/clio-lang/media/blob/master/clio-cut.png)

## Project Status

Clio is in active development and it's not ready for production.

This repo contains code for the Clio parser and analyzer, the code highlighter and language support for different code editors, the web-based Clio editor, documentation and everything related to Clio. All Clio related code will be hosted in this repo until the project has a stable structure.

## Links

*	[Clio on Rosetta Code](http://rosettacode.org/wiki/Clio)
*	[Quick Guide](https://pouya-eghbali.github.io/clio/docs/quick.html)
*	[Web IDE](https://pouya-eghbali.github.io/clio/editor/)
*	[Browser Bundle Size Graph](https://pouya-eghbali.github.io/clio/editor/breakdown.html)
*	[Clio on Trello](https://trello.com/b/WpwsB69B/clio)
*	[Clio Chat (on Telegram)](https://t.me/joinchat/B0kZo0kVldfXldTDqz95XA)

## Examples

You can check the examples in [./examples](https://github.com/pouya-eghbali/clio/tree/master/examples) or you can check
[Clio on Rosetta Code](http://rosettacode.org/wiki/Clio).

## Quick Guide

Clio isn't recognized by github as a language and it doesn't have correct syntax highlighting on github, please visit [Clio Quick Guide web-page](https://pouya-eghbali.github.io/clio/docs/quick.html) for the quick guide, the Clio editor and embedded browser compiler.

Please note this web page isn't that good looking on mobile devices as I have more important concerns with Clio at the moment.

## Features and Work in Progress

- Pure
- Noise-free
- Lazy evaluation
- Lazy data types
- Asynchronous by default
- Functional programming paradigm
- Pipes and flows
- Function overloading
- Custom data types
- Functions are micro-services
- Network-based foreign function interface
- Tensor/array indexing and programming
- Cloud/decentralized/distributed modules and functions
- Event-based flow control

Some of the ideas in the list are currently implemented, some are implemented but need fixing, some others are planned and will be in the core, and there are ideas that were fully implemented in the core, but commented out in the code since they will be migrated in modules or completely removed.

For a list of what's done and what's planned you can check [Clio on Trello](https://trello.com/b/WpwsB69B/clio).

## Project Goals

- Encourage writing clean code
- Encourage writing interconnected micro-functionalities instead of big whole programs
- Make it easier to write decentralized and distributed code
- Take advantage of multi-core CPUs and multiple CPUs by default
- It should be easy to port existing code, and it should be easy to port Clio code to different platforms
- Avoid spaghetti code and callback hell


## Command Line Usage

To install, download or clone this repository:

	git clone https://github.com/pouya-eghbali/clio

You need NodeJS [latest version] and Clio dependencies. To install Clio dependencies in the project directory, do

	npm install

Then `link` clio bin

	npm link

to run a Clio program do

	clio run path/to/file.clio

to highlight a Clio file do

	clio highlight path/to/file.clio

to print the abstract syntax tree

	clio ast path/to/file.clio

and to compile Clio code to JS do

	clio compile path/to/source.clio path/to/output.js

by default Node puts a limit on memory usage, to change this limit please refer to [this guide](https://gist.github.com/motss/f55b92ccab0d434fa6e6cfd07423014b).

## Developing

Clio uses gulp as task runner. Simply doing

	gulp bundle

Will generate the minified browser bundle and the size graph.
