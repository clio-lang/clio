const { map, merge } = require("bean-parser");
const { wrap, values, expressions } = require("../common");

module.exports = merge(
  {
    // Calls
    ...map(
      [
        "symbol",
        "parallelFn",
        "propertyAccess",
        "method",
        "wrapped",
        "parameter",
      ],
      {
        ...map(
          [...values, ...expressions],
          wrap((lhs, rhs) => {
            lhs.isFn = true;
            return {
              type: "callOpen",
              fn: lhs,
              args: [rhs],
            };
          }, 3)
        ),
      }
    ),
    callOpen: {
      ...map(
        [...values, ...expressions],
        wrap((lhs, rhs) => {
          lhs.args.push(rhs);
          return lhs;
        }, 4)
      ),
      ...map(
        ["lineBreak", "ender"],
        wrap((lhs) => {
          const isParameter =
            lhs.fn.type === "parameter" ||
            (lhs.fn.type === "propertyAccess" &&
              lhs.fn.lhs.type === "parameter");
          lhs.type = isParameter ? "parameterCall" : "call";
          return lhs;
        }, 1)
      ),
    },
    pipeOpen: {
      ...map(
        ["call", "parameterCall"],
        wrap((lhs, rhs) => {
          rhs.args.unshift(lhs.data);
          rhs.isMap = lhs.isMap;
          rhs.isFlow = true;
          return rhs;
        })
      ),
      ...map(
        [
          "symbol",
          "parallelFn",
          "method",
          "propertyAccess",
          "wrapped",
          "parameter",
        ],
        wrap((lhs, rhs) => {
          rhs.isFn = true;
          return {
            type: "callOpen",
            fn: rhs,
            args: [lhs.data],
            isMap: lhs.isMap,
            isFlow: true,
          };
        }, 1)
      ),
      awaited: wrap((lhs, rhs) => {
        const { data, isMap } = lhs;
        if (rhs.value.type.startsWith("call")) {
          rhs.value.args.unshift(data);
          rhs.value.isMap = isMap;
          rhs.value.awaited = true;
          rhs.value.await = rhs.await;
          rhs.value.all = rhs.all;
          rhs.value.isFlow = true;
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
          isFlow: true,
        };
      }),
    },
    arrow: {
      mulOp: wrap((lhs, rhs) => {
        return { type: "mapArrow", arrow: lhs, map: rhs };
      }, 4),
    },
  },
  {
    // Calls
    ...map([...values, ...expressions, "data"], {
      arrow: wrap((lhs) => {
        return {
          type: "pipeOpen",
          data: lhs,
        };
      }, 0.31),
      mapArrow: wrap((lhs) => {
        return {
          type: "pipeOpen",
          data: lhs,
          isMap: true,
        };
      }, 0.31),
    }),
  }
);
