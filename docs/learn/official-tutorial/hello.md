# Hello World!

Let's start by a classical hello world example! Open the project directory in your favorite text editor and add the following code to `src/main.clio` file.

```text
export fn main argv:
  console.log "Hello world!"
```

Above is the simplest form of writing a hello world program in Clio, let's break it down a little bit:

1. On the first line, we've defined a function named `main`. Every Clio program needs a `main` function and this function needs to be exported. If you don't know what that means, don't worry, you'll learn soon.
2. On the second line, we call `console.log` function, passing `"Hello world!"` to it.

Running this program should show `Hello world!` in the console. Go on and try it out by running `clio run` in your project's root folder.