module.exports = {
  title: (root) => `import Title from "${root}components/Title.svelte"`,
  bold: (root) => `import Bold from "${root}components/Bold.svelte"`,
  italic: (root) => `import Italic from "${root}components/Italic.svelte"`,
  image: (root) => `import Image from "${root}components/Image.svelte"`,
  link: (root) => `import Link from "${root}components/Link.svelte"`,
  code: (root) => `import Code from "${root}components/Code.svelte"`,
  list: (root) =>
    [
      `import List from "${root}components/List.svelte"`,
      `import ListItem from "${root}components/ListItem.svelte"`,
    ].join("\n"),
  tab: (root) =>
    [
      `import Tabs from "${root}components/Tabs.svelte"`,
      `import TabTitles from "${root}components/TabTitles.svelte"`,
      `import TabTitle from "${root}components/TabTitle.svelte"`,
      `import TabContents from "${root}components/TabContents.svelte"`,
      `import TabContent from "${root}components/TabContent.svelte"`,
    ].join("\n"),
  table: (root) =>
    [
      `import Table from "${root}components/Table.svelte"`,
      `import TableHead from "${root}components/TableHead.svelte"`,
      `import TableRow from "${root}components/TableRow.svelte"`,
      `import TableCell from "${root}components/TableCell.svelte"`,
      `import TableHeadCell from "${root}components/TableHeadCell.svelte"`,
      `import TableBody from "${root}components/TableBody.svelte"`,
    ].join("\n"),
  blockquote: (root) =>
    `import Blockquote from "${root}components/Blockquote.svelte"`,
  blocktext: (root) =>
    `import Blocktext from "${root}components/Blocktext.svelte"`,
  paragraph: (root) =>
    `import Paragraph from "${root}components/Paragraph.svelte"`,
};
