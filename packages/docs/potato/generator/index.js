const modules = require("./modules");

class Generator {
  constructor(compiler) {
    this.title = "";
    this.sections = [];
    this.currentSection = null;
    this.modules = {};
    this.generated = "";
    this.text = "";
    this.tabs = [];
    this.table = [];
    this.isBlockquote = false;
    this.tableAlign;
    this.compiler = compiler;
    this.register();
  }
  register() {
    this.compiler.on("header", (...args) => this.onHeader(...args));
    this.compiler.on("text", (...args) => this.onText(...args));
    this.compiler.on("linebreak", (...args) => this.onLinebreak(...args));
    this.compiler.on("blockquote", (...args) => this.onBlockquote(...args));
    this.compiler.on("blocktext", (...args) => this.onBlocktext(...args));
    this.compiler.on("bold", (...args) => this.onBold(...args));
    this.compiler.on("italic", (...args) => this.onItalic(...args));
    this.compiler.on("image", (...args) => this.onImage(...args));
    this.compiler.on("link", (...args) => this.onLink(...args));
    this.compiler.on("code", (...args) => this.onCode(...args));
    this.compiler.on("inlinecode", (...args) => this.onInlinecode(...args));
    this.compiler.on("tablehead", (...args) => this.onTablehead(...args));
    this.compiler.on("list", (...args) => this.onList(...args));
    this.compiler.on("tab", (...args) => this.onTab(...args));
    this.compiler.on("eof", (...args) => this.onEOF(...args));
  }
  sectionText(text) {
    if (this.currentSection) this.currentSection.text += text + " ";
  }
  onHeader(_, { meta }) {
    this.modules.title = true;
    const { text, level } = meta;
    const title = text.trimLeft().trimRight();
    this.close();
    if (level === 1) this.title = title;
    if (this.currentSection) this.sections.push(this.currentSection);
    this.currentSection = { title, text: "" };
    this.content(`<Title level={${level}} title="${title}" />`);
  }
  onBlockquote(_) {
    this.close();
    this.isBlockquote = true;
  }
  onBlocktext(_, { meta }) {
    const { type } = meta;
    this.close();
    this.isBlocktext = true;
    this.blocktextType = type;
  }
  onTab(_, { meta }) {
    this.modules.tab = true;
    const { text } = meta;
    const title = text.trimLeft().trimRight();
    this.close({ tabs: true });
    this.tabs.push({ title });
  }
  onText(_, { raw }) {
    this.text += raw + " ";
    this.sectionText(raw);
  }
  onBold(_, { meta }) {
    this.modules.bold = true;
    const { text } = meta;
    const trimmed = text.trimLeft().trimRight();
    this.text += `<Bold>${trimmed}</Bold> `;
    this.sectionText(trimmed);
  }
  onItalic(_, { meta }) {
    this.modules.italic = true;
    const { text } = meta;
    const trimmed = text.trimLeft().trimRight();
    this.text += `<Italic>${trimmed}</Italic> `;
    this.sectionText(trimmed);
  }
  onLink(_, { meta }) {
    this.modules.link = true;
    const { text, href } = meta;
    const trimmed = text.trimLeft().trimRight();
    this.text += `<Link href="${href}">${trimmed}</Link> `;
    this.sectionText(trimmed);
  }
  onImage(_, { meta }) {
    this.modules.image = true;
    const { text, src } = meta;
    const trimmed = text.trimLeft().trimRight();
    if (this.text) {
      this.text += `<Image src="${src}" alt="${trimmed}" inline/> `;
    } else {
      this.close();
      this.content(`<Image src="${src}" alt="${trimmed}"/>`);
    }
  }
  onCode(_, { meta }) {
    this.modules.code = true;
    const { code, language } = meta;
    this.close();
    this.content(`<Code code={\`${code}\`} language="${language}"/>`);
  }
  onInlinecode(_, { meta }) {
    this.modules.code = true;
    const { code } = meta;
    this.text += `<Code code="${code}" inline/> `;
  }
  onList(_, { meta: { items } }) {
    this.modules.list = true;
    this.close();
    let list = "";
    const lists = [];
    for (const item of items) {
      const { level, text } = item;
      const trimmed = text.trimLeft().trimRight();
      const bullet = ["*", "-"].includes(item.bullet) ? item.bullet : "numeric";
      const bulletType = ["*", "-"].includes(bullet) ? "bullet" : bullet;
      const currList = lists[lists.length - 1];
      const prevList = lists[lists.length - 2];
      const isNotCurr = currList?.bullet != bullet || currList?.level != level;
      if (isNotCurr) {
        const isPrev = prevList?.bullet == bullet || prevList?.level == level;
        if (isPrev) {
          list += "</ListItem></List></ListItem>";
          lists.pop();
        } else {
          list += `<List bullet="${bulletType}">`;
          lists.push({ level, bullet });
        }
      } else if (currList) {
        list += "</ListItem>";
      }
      list += `<ListItem>${trimmed}`;
      this.sectionText(trimmed);
    }
    list += "</ListItem></List>";
    this.content(list);
  }
  onTablehead(raw, { meta }) {
    const close = () => {
      this.onLinebreak(null, { raw: "\n" });
      this.text += raw.trimLeft();
    };
    this.modules.table = true;
    if (this.table.length) return close();
    if (!this.text?.startsWith("|")) return close();
    if (!this.text?.endsWith("| ")) return close();
    const head = this.text.slice(1, -2).split(/ *\| */);
    this.table.push(head);
    this.tableAlign = meta.align;
    this.text = "";
  }
  onEOF() {
    this.close();
    if (this.currentSection) this.sections.push(this.currentSection);
  }
  onLinebreak(_, { raw }) {
    if (this.table.length) {
      if (this.text?.startsWith("|") && this.text?.endsWith("| ")) {
        const row = this.text.slice(1, -2).split(/ *\| */);
        this.table.push(row);
        this.text = "";
        return;
      }
    }
    if (this.tabs.length) {
      if (this.compiler.code.match(/\s+\n+\|>/)) return;
    }
    if (raw.length > 1) this.close();
  }
  content(content) {
    if (this.tabs.length) {
      const last = this.tabs[this.tabs.length - 1];
      if (last.content) {
        this.close();
      } else {
        last.content = content;
        return;
      }
    }
    this.generated += content;
  }
  close(ignore = {}) {
    if (!ignore.blockquote) this.closeBlockquote();
    if (!ignore.blocktext) this.closeBlocktext();
    if (!ignore.paragraph) this.paragraph();
    if (!ignore.tabs) this.closeTabs();
    if (!ignore.table) this.closeTable();
  }
  closeTabs() {
    const last = this.tabs[this.tabs.length - 1];
    if (last && last.content) {
      const titles = this.tabs.map((tab) => tab.title);
      const contents = this.tabs.map((tab) => tab.content || "");
      this.generated += "<Tabs>";
      this.generated += "<TabTitles>";
      for (const title of titles) {
        this.generated += `<TabTitle>${title}</TabTitle>`;
      }
      this.generated += "</TabTitles>";
      this.generated += "<TabContents>";
      for (const content of contents) {
        this.generated += `<TabContent>${content}</TabContent>`;
      }
      this.generated += "</TabContents>";
      this.generated += "</Tabs>";
      this.tabs = [];
    }
  }
  closeTable() {
    const [head, ...rows] = this.table;
    if (head) {
      const align = this.tableAlign;
      this.table = [];
      const headCells = head
        .map(
          (item, index) =>
            `<TableHeadCell ${align[index] || ""}>${item}</TableHeadCell>`
        )
        .join("");
      const tableHead = `<TableHead><TableRow>${headCells}</TableRow></TableHead>`;
      const tableRows = rows
        .map((row) =>
          row
            .map(
              (item, index) =>
                `<TableCell ${align[index] || ""}>${item}</TableCell>`
            )
            .join("")
        )
        .map((row) => `<TableRow>${row}</TableRow>`)
        .join("");
      this.content(
        `<Table>${tableHead}<TableBody>${tableRows}</TableBody></Table>`
      );
    }
  }
  closeBlockquote() {
    if (!this.isBlockquote) return;
    if (this.text) {
      this.modules.blockquote = true;
      const text = this.text.trimLeft().trimRight();
      this.text = "";
      this.isBlockquote = false;
      this.content(`<Blockquote>${text}</Blockquote>`);
    }
  }
  closeBlocktext() {
    if (!this.isBlocktext) return;
    if (this.text) {
      this.modules.blocktext = true;
      const text = this.text.trimLeft().trimRight();
      this.text = "";
      this.isBlocktext = true;
      this.content(
        `<Blocktext type={"${this.blocktextType}"}>${text}</Blocktext>`
      );
    }
  }
  paragraph() {
    if (this.text) {
      this.modules.paragraph = true;
      const text = this.text.trimLeft().trimRight();
      this.text = "";
      this.content(`<Paragraph>${text}</Paragraph>`);
    }
  }
  svelte() {
    const root = "../".repeat(this.compiler.file.split("/").length - 1);
    let script = "";
    for (const module in this.modules) script += modules[module](root) + "\n";

    const sections =
      "[" + this.sections.map(({ title }) => `"${title}"`).join(",") + "]";
    script += ["export let sections", `sections = ${sections}`].join("\n");
    script = "<script>" + script + "</script>";
    return script + this.generated;
  }
  get() {
    return {
      generated: this.generated,
      sections: this.sections,
      modules: this.modules,
      svelte: this.svelte(),
      title: this.title,
      file: this.compiler.file,
    };
  }
}

module.exports = Generator;
