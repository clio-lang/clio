import enquirer from "enquirer";
import { hasColor } from "enquirer/lib/utils.js";

export class AutoComplete extends enquirer.AutoComplete {
  async pointer(choice, i) {
    let val = await this.element("pointer", choice, i);

    if (typeof val === "string" && hasColor(val)) {
      return val;
    }

    if (val) {
      let styles = this.styles;
      let focused = this.index === i;
      let style = focused ? styles.primary : (val) => val;
      let ele = await this.resolve(
        val[focused ? "on" : "off"] || val,
        this.state
      );
      let styled = !hasColor(ele) ? style(ele) : ele;
      return focused ? styled : " ".repeat(ele.length);
    }
  }
}
