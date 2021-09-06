const { PacketParser } = require("../../lib");
const net = require("net");
const path = require("path");
const { IPCSocket } = require("./socket");
const { EventEmitter } = require("../../common");

class Server extends EventEmitter {
  constructor(config) {
    super();
    this.ipcConfig = config || Server.defaultIPCConfig();
    this.ready = false;
  }
  static getIPCPath({ name }) {
    const parts = [process?.cwd() || ".", name];
    if (process?.platform == "win32") parts.unshift("\\\\?\\pipe");
    return path.join(...parts);
  }
  static defaultIPCConfig() {
    return {
      path: Server.getIPCPath({ name: "ipc.sock" }),
    };
  }
  createIPCServer() {
    if (!this.ipcConfig) return;
    const { path } = this.ipcConfig;
    this.ipcServer = net.createServer();
    this.ipcServer.on("listening", () => this.onListening());
    this.ipcServer.listen(path);
    this.ipcServer.on("connection", (socket) => this.onIPCConnect(socket));
  }
  onListening() {
    this.ready = true;
    this.emit("listening");
  }
  onIPCConnect(socket) {
    const parser = new PacketParser(socket);
    const ipcSocket = new IPCSocket(socket);
    parser.on("message", (data) => this.handleIncoming(ipcSocket, data));
  }
  handleIncoming(ipcSocket, data) {
    this.emit("message", ipcSocket, data);
  }
  start() {
    return this.createIPCServer();
  }
}

module.exports.Server = Server;
