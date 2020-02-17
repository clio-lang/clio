exports.npm = {
  prefix: "npm",
  fetch: ({ name, version }, destination) => {
    // Examples:
    // ({ name: "express", version: "latest" })
    // ({ name: "express", version: "1.2.3" })
  }
};

exports.url = {
  prefix: "url",
  fetch: ({ name, version }, destination) => {
    // Examples:
    // ({ name: "https://foo.com/dependency.zip", version: undefined })
    // ({ name: "https://foo.com/dependency.tar.gz", version: undefined })
  }
};

exports.github = {
  prefix: "github",
  fetch: ({ name, version }, destination) => {
    // Examples:
    // ({ name: "garritfra/clio-greeter", version: "0.1.0" })
    // ({ name: "garritfra/clio-greeter", version: "master" })
    // ({ name: "garritfra/clio-greeter", version: undefined })
  }
};
