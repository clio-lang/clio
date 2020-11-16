const getImport = (clio) => {
  const parseCloudLocation = (location) => {
    const [_, protocol, host, path] = location.match(
      /([a-z]+):\/\/([^\/]+)\/(.*)/
    );
    return { protocol, host, path };
  };

  const clioImportCloud = async (location) => {
    const { protocol, host, path } = parseCloudLocation(location);
    if (!protocol || protocol != "ws")
      throw "Only WS is supported at the moment";
    const executor = await clio.distributed.getExecutor(protocol, host);
    const paths = await executor.getFunctions(path);
    const fns = {};
    for (const key in paths) fns[key.slice(path.length + 1)] = paths[key];
    return fns;
  };

  const clioImportLocal = async (location) => {
    const isClio = location.endsWith(".clio");
    if (isClio) return await require(`${location}.js`).__clioModule(clio);
    const isJs = location.endsWith(".js");
    if (isJs) return require(location);
    try {
      const imported = await require(`${location}.clio.js`).__clioModule(clio);
      return imported;
    } catch (error) {
      const imported = require(location);
      return imported;
    }
  };

  const clioImport = (location) => {
    const isCloud = location.match(/(ws|tcp|udp):\/\//);
    return isCloud ? clioImportCloud(location) : clioImportLocal(location);
  };

  clio.import = clioImport;
  clio.importCloud = clioImportCloud;
};

module.exports.getImport = getImport;
