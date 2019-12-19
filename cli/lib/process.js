const { exec } = require("child_process");

function run(command) {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(err);
        return;
      }

      if (stderr) {
        reject(new Error(stderr));
        return;
      }

      resolve(stdout);
    });
  });
}

module.exports = {
  run
};
