import { EventEmitter } from "../../common.js";

export class WorkerThreadSocket extends EventEmitter {
  constructor(worker) {
    super();
    this.worker = worker;
    this.connect();
  }
  connect() {
    this.worker.on("message", (data) => this.handleWorkerMessage(data));
    this.emit("connect");
  }
  handleWorkerMessage(data) {
    this.emit("message", data);
  }
  send(data) {
    this.worker.postMessage(data, [data.buffer]);
  }
}
