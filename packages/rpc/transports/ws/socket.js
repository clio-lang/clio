import { EventEmitter } from "../../common.js";

export class WSSocket extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
  }
  send(data) {
    this.socket.send(data);
  }
}
