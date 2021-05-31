# Npm section

You can use `[npm]` to override any of the fields in the generated `package.json` file:

```text
[npm]
browserlist = ["> 0.2%", "not dead"]
main = "index.html"

[npm.devDependencies]
parcel = "next"

[npm.scripts]
start = "parcel index.html"
host = "node .clio/host.js"
build = "parcel build index.html"
```

