const { EventEmitter } = require("../../common");

class WebWorkerSocket extends EventEmitter {
  constructor(worker) {
    super();
    this.worker = worker;
    this.connect();
  }
  connect() {
    this.worker.onmessage = (event) => this.handleWorkerMessage(event.data);
    this.emit("connect");
  }
  handleWorkerMessage(data) {
    this.emit("message", data);
  }
  send(data) {
    this.worker.postMessage(data);
  }
}

module.exports.WebWorkerSocket = WebWorkerSocket;
