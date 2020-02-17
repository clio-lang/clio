module.exports = {
  prefix: "npm",
  fetch: ({ name, version }, destination) => {
    console.log("Fetching", name);
    return Promise.resolve(true);
  }
};
