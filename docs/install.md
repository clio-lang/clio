---
description: How to install Clio
---

# Install

## Install via NPM

To install Clio language, you'll need Node.js and NPM. After installing Node and NPM, you can install Clio by running:

<<<<<<< HEAD
`npm i -g clio-lang`
=======
`npm i -g clio`

> > > > > > > develop

Check your installation by running `clio` in your local shell. You're good to go!

## Install via Arch User Repository

<<<<<<< HEAD
If you are using an Arch-based linux distribution, you might consider installing Clio via the Arch User Repository (AUR).
You can get more information about the `clio-lang` package here:

# https://aur.archlinux.org/packages/clio-lang

If you are using an Arch-based linux distribution, you might consider installing Clio via the Arch User Repository \(AUR\). You can get more information about the `clio-lang` package here:

[https://aur.archlinux.org/packages/clio-lang](https://aur.archlinux.org/packages/clio-lang)

> > > > > > > develop

## Bleeding Edge Installation

Clio is in active development and installation is only recommended for testing, early adopting and development so it is recommended to install from git before we reach a stable version one release.

To install from git, you'll need Node.js, NPM and git. You need to clone the repository:

`git clone https://github.com/clio-lang/clio`

<<<<<<< HEAD
Then `cd` to the project directory:

`cd clio`

Now you need to install dependencies, to do that run:

`npm install`

Now you need to link the `clio` executable:

# `npm link`

Then `cd` to the project directory:

`cd clio`

Now you need to install dependencies, to do that run:

`npm install`

Now you need to link the `clio` executable:

`npm link`

If you are planning to make changes to the local clio installation, you will need to specify its location in the `CLIOPATH` environment variable. This ensures, that local clio packages will be used when building a project.

### Setting CLIOPATH on MacOS/Linux

Add this line to your `.bashrc` file:

```text
export CLIOPATH=<path-to-clio-installation>
```

### Setting CLIOPATH on Windows

TBD

> > > > > > > develop
