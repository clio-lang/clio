const calls = merge(
  {
    // Function calls
    ...map(["symbol", "parallelFn"], {
      ...ignore("space", "zeroSpace"),
      ...map(
        values,
        wrap((lhs, rhs) => {
          return {
            type: "callOpen",
            fn: lhs,
            args: [types.get(rhs)],
          };
        }, 0.4)
      ),
      ...map(
        expressions,
        wrap((lhs, rhs) => {
          return {
            type: "callOpen",
            fn: lhs,
            args: [types.get(rhs)],
          };
        }, 0.4)
      ),
    }),
    arrow: {
      ...ignore("space"),
      mulOp: wrap((lhs, rhs) => {
        return { type: "mapArrow", arrow: lhs, map: rhs };
      }, 4),
    },
    callOpen: {
      ...ignore("space"),
      ...map(
        values,
        wrap((lhs, rhs) => {
          lhs.args.push(types.get(rhs));
          return lhs;
        }, 0.2)
      ),
      ...map(
        expressions,
        wrap((lhs, rhs) => {
          lhs.args.push(types.get(rhs));
          return lhs;
        }, 2)
      ),
      ...map(
        ["lineBreak"],
        wrap((lhs) => {
          lhs.type = "call";
          return lhs;
        })
      ),
      arrow: wrap((lhs) => {
        lhs.type = "call";
        return {
          type: "pipeOpen",
          data: types.get(lhs),
        };
      }, 0.3),
      mapArrow: wrap((lhs) => {
        lhs.type = "call";
        return {
          type: "pipeOpen",
          data: types.get(lhs),
          isMap: true,
        };
      }, 0.3),
    },
    pipeOpen: {
      ...ignore("space", "lineBreak"),
      callOpen: wrap((lhs, rhs) => {
        rhs.type = "call";
        rhs.args.unshift(lhs.data);
        rhs.isMap = lhs.isMap;
        return rhs;
      }, 0),
      awaited: wrap((lhs, rhs) => {
        const { data, isMap } = lhs;
        if (rhs.value.type.startsWith("call")) {
          rhs.value.args.unshift(data);
          rhs.value.isMap = isMap;
          rhs.value.awaited = true;
          rhs.value.await = rhs.await;
          rhs.value.all = rhs.all;
          return rhs.value;
        }
        return {
          type: "call",
          fn: rhs.value,
          args: [data],
          isMap,
          awaited: true,
          all: rhs.all,
          await: rhs.await,
        };
      }),
      symbol: wrap((lhs, rhs) => {
        return {
          type: "call",
          fn: rhs,
          args: [lhs.data],
          isMap: lhs.isMap,
        };
      }, 0),
      parallelFn: wrap((lhs, rhs) => {
        return {
          type: "call",
          fn: rhs,
          args: [lhs.data],
          isMap: lhs.isMap,
        };
      }, 0.5),
    },
    call: {
      ...ignore("space", "lineBreak"),
      arrow: wrap((lhs) => {
        return {
          type: "pipeOpen",
          data: types.get(lhs),
        };
      }, 0.25),
      mapArrow: wrap((lhs) => {
        return {
          type: "pipeOpen",
          data: types.get(lhs),
          isMap: true,
        };
      }, 0.25),
    },
  },
  {
    ...map(values, {
      ...ignore("space"),
      arrow: wrap((lhs) => {
        return {
          type: "pipeOpen",
          data: types.get(lhs),
        };
      }, 0.25),
      mapArrow: wrap((lhs) => {
        return {
          type: "pipeOpen",
          data: types.get(lhs),
          isMap: true,
        };
      }, 0.25),
    }),
  }
);
