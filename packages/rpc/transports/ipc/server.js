import { EventEmitter } from "../../common.js";
import { IPCSocket } from "./socket.js";
import { PacketParser } from "../../lib/index.js";
import { createServer } from "net";
import { join } from "path";

export class Server extends EventEmitter {
  constructor(config) {
    super();
    this.ipcConfig = config || Server.defaultIPCConfig();
    this.ready = false;
  }
  static getIPCPath({ name }) {
    const parts = [process?.cwd() || ".", name];
    if (process?.platform == "win32") parts.unshift("\\\\?\\pipe");
    return join(...parts);
  }
  static defaultIPCConfig() {
    return {
      path: Server.getIPCPath({ name: "ipc.sock" }),
    };
  }
  createIPCServer() {
    if (!this.ipcConfig) return;
    const { path } = this.ipcConfig;
    this.ipcServer = createServer();
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
