# Parallelism

Every function you define in Clio, has a parallel, distributed version. This parallel version can be accessed using the _sandwich_ syntax. Let's start by and example and define a fibonacci function:

```text
fn fib n:
  if n < 2: n
  else: (fib n - 1)
      + (fib n - 2)

export fn main argv:
  [39 40 41 42]
    -> * fib
    -> * item: console.log item
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=fn%20fib%20n%3A%0A%20%20if%20n%20%3C%202%3A%20n%0A%20%20else%3A%20%28fib%20n%20-%201%29%0A%20%20%20%20%20%20%2B%20%28fib%20n%20-%202%29%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20%5B39%2040%2041%2042%5D%0A%20%20%20%20-%3E%20*%20fib%0A%20%20%20%20-%3E%20*%20item%3A%20console.log%20item)

In the above example, we are running `fib` function on all the members of our array. The code above, first runs `fib 39`, and when the result is ready it will run the next, which is `fib 40` and so on. If I run the above code on my laptop, it will take about 6.2 seconds to finish. However, we can make the above code faster, by running all the fibs in parallel, and at the same time. To do this, we will use the parallel version of our `fib` function, which can be accessed using the _sandwich_ syntax:

```text
fn fib n:
  if n < 2: n
  else: (fib n - 1)
      + (fib n - 2)

export fn main argv:
  [39 40 41 42]
    -> * await |fib|
    -> * item: console.log item
```

[Try on playground.](https://clio-playground.pouyae.vercel.app/?code=fn%20fib%20n%3A%0A%20%20if%20n%20%3C%202%3A%20n%0A%20%20else%3A%20%28fib%20n%20-%201%29%0A%20%20%20%20%20%20%2B%20%28fib%20n%20-%202%29%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20%5B39%2040%2041%2042%5D%0A%20%20%20%20-%3E%20*%20await%20%7Cfib%7C%0A%20%20%20%20-%3E%20*%20item%3A%20console.log%20item)

{% hint style="warning" %}
Parallel functions are async, you need to await them if that's necessary.
{% endhint %}

This time, if I run the above code it will take 2.7 seconds instead. Much faster, isn't it?

{% hint style="info" %}
Being faster isn't the only benefit of running functions in parallel. On the browser, the regular non-parallel fib blocks the ui, but the parallel version doesn't. If you try the above examples in the playground you will see this in action.
{% endhint %}

You can use parallel functions in combination with await blocks or branches, to run different type of tasks at the same time.
