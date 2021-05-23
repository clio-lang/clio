const parseCloudLocation = (location) => {
  const [_, protocol, host, path] = location.match(
    /([a-z]+):\/\/([^\/]+)\/(.*)/
  );
  return { protocol, host, path };
};

const supported = ["tcp", "ipc", "ws"];

const remote = async (clio, location) => {
  const { protocol, host, path } = parseCloudLocation(location);
  if (!supported.includes(protocol))
    throw new Error(`Protocol "${protocol}" is not supported.`);
  const executor = await clio.distributed.getExecutor(protocol, host);
  const paths = await executor.getFunctions(path);
  const fns = {};
  for (const key in paths) fns[key.slice(path.length + 1)] = paths[key];
  return fns;
};

module.exports = remote;
