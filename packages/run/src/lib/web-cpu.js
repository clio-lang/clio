// https://stackoverflow.com/a/21818781
// create worker concurrency estimation code as blob

const cpu = {};

const workerFn = function () {
  self.addEventListener("message", () => {
    // run worker for 4 ms
    const st = Date.now();
    const et = st + 4;
    while (Date.now() < et);
    self.postMessage({ st: st, et: et });
  });
};

const blobUrl = () =>
  URL.createObjectURL(
    new Blob(["(", workerFn.toString(), ")()"], {
      type: "application/javascript",
    })
  );

function sample(max, samples, numWorkers) {
  return new Promise((resolve) => {
    if (samples === 0) {
      // get overlap average
      const avg = Math.floor(
        max.reduce(function (avg, x) {
          return avg + x;
        }, 0) / max.length
      );
      return resolve(Math.max(1, avg));
    }
    map(numWorkers, async function (err, results) {
      max.push(reduce(numWorkers, results));
      resolve(await sample(max, samples - 1, numWorkers));
    });
  });
}

function map(numWorkers, callback) {
  const workers = [];
  const results = [];
  for (let i = 0; i < numWorkers; ++i) {
    const worker = new Worker(blobUrl());
    worker.addEventListener("message", function (e) {
      results.push(e.data);
      if (results.length === numWorkers) {
        for (let i = 0; i < numWorkers; ++i) {
          workers[i].terminate();
        }
        callback(null, results);
      }
    });
    workers.push(worker);
  }
  for (let i = 0; i < numWorkers; ++i) {
    workers[i].postMessage(i);
  }
}

function reduce(numWorkers, results) {
  // find overlapping time windows
  const overlaps = [];
  for (let n = 0; n < numWorkers; ++n) {
    const r1 = results[n];
    const overlap = (overlaps[n] = []);
    for (let i = 0; i < numWorkers; ++i) {
      if (n === i) {
        continue;
      }
      let r2 = results[i];
      if (
        (r1.st > r2.st && r1.st < r2.et) ||
        (r2.st > r1.st && r2.st < r1.et)
      ) {
        overlap.push(i);
      }
    }
  }
  // get maximum overlaps ... don't include overlapping worker itself
  // as the main JS process was also being scheduled during the work and
  // would have to be subtracted from the estimate anyway
  return overlaps.reduce(function (max, overlap) {
    return Math.max(max, overlap.length);
  }, 0);
}

export async function getCPUCount() {
  if (!cpu.count) {
    cpu.count =
      window.navigator.hardwareConcurrency || (await sample([], 10, 16));
  }
  return cpu.count;
}
