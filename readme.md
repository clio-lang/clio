[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fclio-lang%2Fclio.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fclio-lang%2Fclio?ref=badge_shield)

![Clio Logo](https://raw.githubusercontent.com/clio-lang/media/master/logo-128x128.png)

# Clio

Clio is a pure functional lazy-evaluated programming language targeting decentralized and distributed systems. It is made to take advantage of multiple CPUs and CPU cores (parallelism) by default, to run on clusters and on the cloud easily.

Clio compiles to JavaScript. This makes Clio fast, easy to port and easy to extend. It gives Clio a free JIT compiler, a powerful VM and access to lots of existing libraries. It enables Clio to run in the browser and on servers, and anywhere JavaScript can run.

Read [Clio introduction](https://medium.com/@eghbali/introduction-to-clio-40dbbf9c250b) blog post on [medium](https://medium.com/@eghbali/introduction-to-clio-40dbbf9c250b).

![Clio Logo](https://raw.githubusercontent.com/clio-lang/media/master/clio-cut.png)

## Install

To install you'll need Node.js (latest version) and NPM. Clio is hosted on NPM, to install it simply do

```bash
npm i -g clio-lang
```

## Command Line Usage

To see a list of available `clio` commands and their description you can run

```bash
clio --help
```

## Project Status

Clio is in active development and it's not ready for production.
It is in a highly experimental state, although some stable demonstrations and
test programs exist, it is not recommended to use in production.

## Links

*	[Clio Website](http://clio-lang.org)
*	[Discourse](http://forum.clio-lang.org)
*	[Documentation](http://docs.clio-lang.org)
*	[Clio on Rosetta Code](http://rosettacode.org/wiki/Clio)
*	[Quick Guide](https://clio-lang.github.io/clio-docs/quick.html)
*	[Web IDE](https://clio-lang.github.io/clio-editor/)
*	[Clio on Trello](https://trello.com/b/WpwsB69B/clio)
*	[Clio Chat (on Telegram)](https://t.me/joinchat/B0kZo0kVldfXldTDqz95XA)

## Examples

You can check the examples in [examples repository](https://github.com/clio-lang/examples) or you can check
[Clio on Rosetta Code](http://rosettacode.org/wiki/Clio).

## Quick Guide

Clio isn't recognized by github as a language and it doesn't have correct syntax highlighting on github, please visit [Clio Quick Guide web-page](https://clio-lang.github.io/clio-docs/quick.html) for the quick guide, the Clio editor and embedded browser compiler.

The above quick guide isn't complete, a better documentation for Clio will be hosted on [docs.clio-lang.org](http://docs.clio-lang.org) soon.

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

## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fclio-lang%2Fclio.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fclio-lang%2Fclio?ref=badge_large)
