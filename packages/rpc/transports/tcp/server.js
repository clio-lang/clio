const readline = require("readline");
const net = require("net");
const { TCPSocket } = require("./socket");
const { EventEmitter } = require("../../common");

class Server extends EventEmitter {
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
    this.tcpServer = net.createServer();
    this.tcpServer.on("listening", () => this.onListening());
    this.tcpServer.listen(port, host);
    this.tcpServer.on("connection", (socket) => this.onTCPConnect(socket));
  }
  onListening() {
    this.ready = true;
    this.emit("listening");
  }
  onTCPConnect(socket) {
    socket.rl = readline.createInterface(socket);
    socket.rl.on("line", (data) => this.handleIncoming(socket, data));
    socket.on("close", () => socket.rl.close());
  }
  handleIncoming(socket, data) {
    const tcpSocket = new TCPSocket(socket);
    this.emit("message", tcpSocket, data);
  }
  start() {
    return this.createTCPServer();
  }
}

module.exports.Server = Server;
