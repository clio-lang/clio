const path = require("path");
const fs = require("fs");
const { getPlatform } = require("../lib/platforms");
const { getBuildTarget, getDestinationFromConfig, build } = require("./build");
const { CONFIGFILE_NAME, getPackageConfig } = require("clio-manifest");
const { getHostConfig, writeHostConfig } = require("clio-manifest");
const { error } = require("../lib/colors");

exports.command = "host [source] [protocol]";

exports.describe = "Compile and host Clio file";

exports.builder = {
  source: {
    describe: "Source directory to read from",
    type: "string",
    default: path.resolve("."),
  },
  config: {
    describe: "Path to override config file",
    type: "string",
  },
  server: {
    describe: "Start a server",
    type: "boolean",
  },
  workers: {
    describe: 'Workers to summon ("cpu" or a number)',
    type: "string",
  },
  protocol: {
    describe: "Choose the hosting protocol",
    type: "string",
  },
  host: {
    describe: "Host name to use for TCP or WS",
    type: "string",
  },
  port: {
    describe: "Port number to use for TCP or WS",
    type: "number",
  },
  path: {
    describe: "Path to connect to (IPC)",
    type: "string",
  },
  url: {
    describe: "URL to connect to (WS)",
    type: "string",
  },
  clean: {
    describe: "Clean up previous overrides",
    type: "boolean",
  },
};

exports.handler = (argv) => {
  host(argv, argv._.slice(1));
};

async function host(args, ...platformOptions) {
  try {
    await build(args.source, null, { skipBundle: true });

    const config = getPackageConfig(path.join(args.source, CONFIGFILE_NAME));
    const target = getBuildTarget(null, config); // No target override
    const destination = getDestinationFromConfig(args.source, target, config);
    const platform = getPlatform(target);

    if (!platform) {
      throw new Error(`Platform "${target}" is not supported.`);
    }

    if (args.clean) {
      const hostDir = path.join(destination, ".clio", ".host");
      if (fs.existsSync(hostDir)) fs.rmSync(hostDir, { recursive: true });
    }

    // Check if we need to override the config:
    if (args.config) {
      // Read config file:
      const hostConfig = getHostConfig(args.config);
      // Write rpc.json file:
      const relativeMain = config.main.slice(target.length);
      const configName = writeHostConfig(destination, hostConfig, relativeMain);
      return await platform.host(destination, configName, ...platformOptions);
    } else if (args.protocol === "tcp") {
      // Make config object
      const hostConfig = { servers: [], workers: [] };
      if (args.workers) {
        const worker = {
          count: args.workers,
          proto: "tcp",
        };
        if (args.host && args.port) {
          const addr = args.host === "0.0.0.0" ? "127.0.0.1" : args.host;
          worker.port = args.port;
          worker.host = addr;
        } else {
          worker.server = "default";
        }
        hostConfig.workers = [worker];
      }
      if (args.server) {
        const server = { name: "default", proto: "tcp" };
        if (args.host && args.port) {
          server.port = args.port;
          server.host = args.host;
        }
        hostConfig.servers = [server];
      }
      // Write rpc.json file:
      const relativeMain = config.main.slice(target.length);
      const configName = writeHostConfig(destination, hostConfig, relativeMain);
      return await platform.host(destination, configName, ...platformOptions);
    } else if (args.protocol === "ipc") {
      // Make config object
      const hostConfig = { servers: [], workers: [] };
      if (args.workers) {
        const worker = {
          count: args.workers,
          proto: "ipc",
        };
        if (args.path) {
          worker.path = args.path;
        } else {
          worker.server = "default";
        }
        hostConfig.workers = [worker];
      }
      if (args.server) {
        const server = { name: "default", proto: "ipc" };
        if (args.path) server.path = args.path;
        hostConfig.servers = [server];
      }
      // Write rpc.json file:
      const relativeMain = config.main.slice(target.length);
      const configName = writeHostConfig(destination, hostConfig, relativeMain);
      return await platform.host(destination, configName, ...platformOptions);
    } else if (args.protocol === "ws") {
      // Make config object
      const hostConfig = { servers: [], workers: [] };
      if (args.workers) {
        const worker = {
          count: args.workers,
          proto: "ws",
        };
        if (args.host && args.port) {
          const addr = args.host === "0.0.0.0" ? "127.0.0.1" : args.host;
          worker.url = `ws://${addr}:${port}`;
        } else if (args.url) {
          worker.url = url;
        } else {
          worker.server = "default";
        }
        hostConfig.workers = [worker];
      }
      if (args.server) {
        const server = { name: "default", proto: "ws" };
        if (args.host && args.port) {
          server.port = args.port;
          server.host = args.host;
        }
        hostConfig.servers = [server];
      }
      // Write rpc.json file:
      const relativeMain = config.main.slice(target.length);
      const configName = writeHostConfig(destination, hostConfig, relativeMain);
      return await platform.host(destination, configName, ...platformOptions);
    } else if (args.protocol) {
      throw new Error(`Protocol "${args.protocol}" is not supported.`);
    } else {
      return await platform.host(destination, null, ...platformOptions);
    }
  } catch (e) {
    error(e);
  }
}

exports.host = host;
