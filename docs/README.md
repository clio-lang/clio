# Clio Documentation

{% hint style="danger" %}
This project is set to be renamed, read more [here](https://github.com/clio-lang/clio/issues/193). You can also use the same link to suggest a new name for the language.
{% endhint %}

Clio is a modern, functional, parallel programming language targeting decentralized and distributed systems. It is made to take advantage of multiple CPUs and CPU cores \(parallelism\) by default, and to run on clusters and on the cloud easily.

Clio compiles to JavaScript. This enables Clio to run in the browser and on servers, and anywhere JavaScript can run. Furthermore, Clio can take advantage of the JavaScript ecosystem, tools and libraries. On this website, you will find numerous useful information about Clio, and also learn how to use it and develop with it.

![Calculate fib of 37 to 40 in parallel](.gitbook/assets/clio.png)

Click [here](https://playground.clio-lang.org/?code=fn%20fib%20n%3A%0A%20%20if%20n%20%3C%202%3A%20n%0A%20%20else%3A%20%28fib%20n%20-%201%29%0A%20%20%20%20%20%20%2B%20%28fib%20n%20-%202%29%0A%0Aexport%20fn%20main%20argv%3A%0A%20%20%5B37%2038%2039%2040%5D%0A%20%20%20%20-%3E%20*%20%5Bawait%5D%20%7Cfib%7C%0A%20%20%20%20-%3E%20*%20%28console.log%20%40it%29) to run this example on the playground, click next to get started with Clio.

{% hint style="danger" %}
Clio was recently rewritten from scratch, some parts of this document have been updated to reflect the new changes, but not all pages are updated. This documentation is a work in progress.
{% endhint %}

