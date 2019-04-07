module.exports = {
  server: {
    command: "node index.js host tests/test.host.clio"
  },
  launch: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }
};
