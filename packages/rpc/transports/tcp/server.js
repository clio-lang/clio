import { EventEmitter } from "../../common.js";
import { PacketParser } from "../../lib/index.js";
import { TCPSocket } from "./socket.js";
import { createServer } from "net";

export class Server extends EventEmitter {
  constructor(config) {
    super();
    this.tcpConfig = config || Server.defaultTCPConfig();
    this.ready = false;
  }
  static defaultTCPConfig() {
    return { port: 4444, host: "0.0.0.0" };
  }
  createTCPServer() {
    if (!this.tcpConfig) return;
    const { port, host } = this.tcpConfig;
    this.tcpServer = createServer();
    this.tcpServer.on("listening", () => this.onListening());
    this.tcpServer.listen(port, host);
    this.tcpServer.on("connection", (socket) => this.onTCPConnect(socket));
  }
  onListening() {
    this.ready = true;
    this.emit("listening");
  }
  onTCPConnect(socket) {
    const parser = new PacketParser(socket);
    const tcpSocket = new TCPSocket(socket);
    parser.on("message", (data) => this.handleIncoming(tcpSocket, data));
  }
  handleIncoming(tcpSocket, data) {
    this.emit("message", tcpSocket, data);
  }
  start() {
    return this.createTCPServer();
  }
}
