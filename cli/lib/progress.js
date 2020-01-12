const ora = require("ora");

class Progress {
  constructor(silent = false, startingText = null) {
    this.silent = silent;
    this.progress = silent ? null : ora(startingText);
  }

  start(text) {
    if (this.silent) return;
    this.progress.start(text);
  }

  succeed(text = null) {
    if (this.silent) return;
    this.progress.succeed(text);
  }

  fail(text = null) {
    if (this.silent) return;
    this.progress.fail(text);
  }
}

module.exports = {
  Progress
};
