const { EventEmitter } = require("../../common");

class WebWorkerSocket extends EventEmitter {
  constructor(worker) {
    super();
    this.worker = worker;
    this.messageIds = new Set();
    this.connect();
  }
  connect() {
    this.worker.on("message", (data) => this.handleWorkerMessage(data));
    this.emit("connect");
  }
  handleWorkerMessage(event) {
    const { data } = event;
    const { id } = data;
    if (this.messageIds.delete(id)) this.emit("message", data);
  }
  send(data) {
    const { id } = data;
    this.messageIds.add(id);
    this.worker.postMessage(data);
  }
}

module.exports.WebWorkerSocket = WebWorkerSocket;
