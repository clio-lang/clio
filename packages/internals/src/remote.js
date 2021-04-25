const parseCloudLocation = (location) => {
  const [_, protocol, host, path] = location.match(
    /([a-z]+):\/\/([^\/]+)\/(.*)/
  );
  return { protocol, host, path };
};

const remote = async (clio, location) => {
  const { protocol, host, path } = parseCloudLocation(location);
  if (!protocol || protocol != "ws") throw "Only WS is supported at the moment";
  const executor = await clio.distributed.getExecutor(protocol, host);
  const paths = await executor.getFunctions(path);
  const fns = {};
  for (const key in paths) fns[key.slice(path.length + 1)] = paths[key];
  return fns;
};

module.exports = remote;
