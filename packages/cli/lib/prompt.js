const { AutoComplete } = require("enquirer");
const utils = require("enquirer/lib/utils");

class NicerAutoComplete extends AutoComplete {
  async pointer(choice, i) {
    let val = await this.element("pointer", choice, i);

    if (typeof val === "string" && utils.hasColor(val)) {
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
      let styled = !utils.hasColor(ele) ? style(ele) : ele;
      return focused ? styled : " ".repeat(ele.length);
    }
  }
}

module.exports.AutoComplete = NicerAutoComplete;
