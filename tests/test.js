class Generator {
  constructor(fn, data, length) {
    this.fn = fn;
    this.data = data;
    this.length = length;
  }
  get(i) {
    return this.fn(i, this);
  }
  len() {
    return this.length.constructor == Function ? this.length(this) : this.length;
  }
}

var a = new Generator(
  (i, self) => self.data[i],
  [1, 2, 3, 4],
  self => self.data.length,
);

for (var i = 0; i < a.len(); i++) {
  console.log(a.get(i));
}

var r = new Generator(
  (i, self) => self.data[0]+self.data[2]*i,
  [10, 0, -1],
  self => Math.abs((self.data[0]-self.data[1])/self.data[2]),
);

for (var i = 0; i < r.len(); i++) {
  console.log(r.get(i));
}

/*
class Slicer {
  constructor(_) {
    this.start = _.start;
    this.end   = _.end;
    this.step  = _.step;
  }
  slice(data) {
    var start = this.start || 0;
    var end   = this.end || data.length;
    data = data.slice(start, end);
    // we'll take care of step later
    return data;
  }
}

function slice(data, slicers) {
  var first = slicers.shift();
  if (first.constructor == Slicer) {
    data = first.slice(data);
  } else {
    data = data[first];
  }
  if (!slicers.length) {
    return data;
  }
  return data.map(d => slice(d, slicers.slice()));
}

a =
[
  [[1, 2, 3], [1, 2, 3], [1, 2, 3]],
  [[3, 4, 5], [3, 4, 5], [3, 5, 6]],
  [[5, 6, 7], [5, 6, 7], [5, 6, 7]],
]

// a[1:3 1:3 1:3]

console.log(
  slice(a, [new Slicer({start:1, end:3}),
            new Slicer({start:1, end:3}),
            new Slicer({start:1, end:3})])
);
*/
