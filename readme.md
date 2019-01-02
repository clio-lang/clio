# Clio

Clio is a pure functional lazy-evaluated programming language targeting decentralized and distributed systems. It is made to take advantage of multiple CPUs and CPU cores (parallelism) by default and to run on clusters and on the cloud easily.

Clio complies to JavaScript. This makes Clio fast, easy to port and easy to extend. It gives Clio a free JIT, a powerful vm and compiler. It makes Clio able to run in browser and on server, and anywhere JavaScript can run.

## Project Status

Clio is in active development and it's not ready for production.

This repo contains code for Clio parser and analyzer, code highlighter and language support for different code editors, web-based Clio editor, documentation and everything related to Clio. All Clio related code will be host in this repo until the project has a stable form.

## Quick Guide

Clio isn't recognized by github as a language and it doesn't have correct syntax highlighting on github, please visit [Clio Quick Guide web-page](https://pouya-eghbali.github.io/clio/docs/quick.html) for a quick guide, the Clio editor and embedded browser compiler.

Please note this web page isn't that good looking on mobile devices as for I have more important concerns with Clio at the moment.

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
- Network based foreign function interface
- Tensor/array indexing and programming
- Cloud/decentralized/distributed modules and functions
- Event based flow control

Some of the ideas in the list are currently implemented, some are implemented but need fixing, some others are planned and will be in core, and there are ideas that were fully implemented but removed.

For a list of what's done and what's planned you can check [Clio on Trello](https://trello.com/b/WpwsB69B/clio)

## Project Goals

- Encourage writing clean code
- Encourage writing interconnected micro-functionalities instead of big whole programs
- Make it easier to write decentralized and distributed code
- Take advantage of multi-core CPUs and multiple CPUs by default
- It should be easy to port existing code, and it should be easy to port Clio code to different platforms
- Avoid spaghetti code and callback hell


## Command Line Usage

For command line usage you need NodeJS [latest version] and the dependencies. To install dependencies, when you're in project directory, do

	npm install

`index.js` is program entry and `browser.js` is main file for browser. To compile for browser do

	browserify browser.js | uglifyjs > editor/clio.js

to run a file do

	node index.js run path/to/file.clio

to print abstract syntax tree

	node index.js ast path/to/file.clio

and to compile Clio code to JS do

	node index.js compile path/to/source.clio path/to/output.js

by default Node puts a limit on memory usage, to change this limit please refer to [this guide](https://gist.github.com/motss/f55b92ccab0d434fa6e6cfd07423014b)
