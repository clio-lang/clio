import { EventEmitter } from "../../common.js";
import { Server as WSServer } from "ws";
import { WSSocket } from "./socket.js";

export class Server extends EventEmitter {
  constructor(config) {
    super();
    this.wsConfig = config || Server.defaultWSConfig();
    this.ready = false;
  }
  static defaultWSConfig() {
    return { port: 8080, url: "ws://localhost:8080" };
  }
  createWSServer() {
    if (!this.wsConfig) return;
    const { port } = this.wsConfig;
    this.wsServer = new WSServer({ port });
    this.wsServer.on("listening", () => this.onListening());
    this.wsServer.on("connection", (socket) => this.onWSConnect(socket));
  }
  onListening() {
    this.ready = true;
    this.emit("listening");
  }
  onWSConnect(socket) {
    const wsSocket = new WSSocket(socket);
    socket.on("message", (data) => this.handleIncoming(wsSocket, data));
  }
  handleIncoming(socket, data) {
    this.emit("message", socket, data);
  }
  start() {
    return this.createWSServer();
  }
}
