const readline = require("readline");
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
    const parts = [process.cwd(), name];
    if (process.platform == "win32") parts.unshift("\\\\?\\pipe");
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
    socket.rl = readline.createInterface(socket);
    socket.rl.on("line", (data) => this.handleIncoming(socket, data));
    socket.on("close", () => socket.rl.close());
  }
  handleIncoming(socket, data) {
    const ipcSocket = new IPCSocket(socket);
    this.emit("message", ipcSocket, data);
  }
  start() {
    return this.createIPCServer();
  }
}

module.exports.Server = Server;
