---
description: Getting Started with Clio
---

Use Clios integrated CLI to bootstrap a new project. To do so, run:

```
clio new helloclio
```

Change into the directory using `cd helloclio` and run the automatically generated `index.clio` file with `clio run`. How does Clio know which file to run? Take a look at `cliopkg.toml`. The field `main` specifies the entrypoint of your application. You can also specify other fields such as information about the author, the version of the project and much more. To list all available commands of Clio, simply run `clio` in your shell.