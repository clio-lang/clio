import { ignore, wrap } from "../common.js";

import { map } from "bean-parser";

export default {
  // Export
  decoratorCall: {
    ...ignore("lineBreak"),
    function: wrap((lhs, rhs) => {
      rhs.type = "decoratedFunction";
      rhs.decorators = [lhs];
      return rhs;
    }),
    exportedFunction: wrap((lhs, rhs) => {
      rhs.type = "decoratedExportedFunction";
      rhs.value.decorators = [lhs];
      return rhs;
    }),
    ...map(
      ["decoratorCall", "decorator", "decoratorAccess"],
      wrap((lhs, rhs) => {
        return {
          type: "decorators",
          decorators: [lhs, rhs],
        };
      }, 0)
    ),
  },
  ...map(["decorator", "decoratorAccess"], {
    ...ignore("lineBreak"),
    function: wrap((lhs, rhs) => {
      rhs.type = "decoratedFunction";
      rhs.decorators = [lhs];
      return rhs;
    }),
    exportedFunction: wrap((lhs, rhs) => {
      rhs.type = "decoratedExportedFunction";
      rhs.value.decorators = [lhs];
      return rhs;
    }),
    ...map(
      ["decoratorCall", "decorator", "decoratorAccess"],
      wrap((lhs, rhs) => {
        return {
          type: "decorators",
          decorators: [lhs, rhs],
        };
      }, 0)
    ),
  }),
  decorators: {
    ...ignore("lineBreak"),
    function: wrap((lhs, rhs) => {
      rhs.type = "decoratedFunction";
      rhs.decorators = lhs.decorators;
      return rhs;
    }),
    exportedFunction: wrap((lhs, rhs) => {
      rhs.type = "decoratedExportedFunction";
      rhs.value.decorators = lhs.decorators;
      return rhs;
    }),
    ...map(
      ["decoratorCall", "decorator", "decoratorAccess"],
      wrap((lhs, rhs) => {
        lhs.decorators.push(rhs);
        return lhs;
      }, 0)
    ),
  },
};
