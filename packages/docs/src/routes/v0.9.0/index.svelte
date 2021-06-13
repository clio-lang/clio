<script>import Title from "../../components/Title.svelte"
import Section from "../../components/Section.svelte"
import Image from "../../components/Image.svelte"
import Bold from "../../components/Bold.svelte"
import Italic from "../../components/Italic.svelte"
import Paragraph from "../../components/Paragraph.svelte"
import Link from "../../components/Link.svelte"
import Code from "../../components/Code.svelte"
import List from "../../components/List.svelte"
import ListItem from "../../components/ListItem.svelte"
import Blockquote from "../../components/Blockquote.svelte"
import Table from "../../components/Table.svelte"
import TableHead from "../../components/TableHead.svelte"
import TableRow from "../../components/TableRow.svelte"
import TableCell from "../../components/TableCell.svelte"
import TableHeadCell from "../../components/TableHeadCell.svelte"
import TableBody from "../../components/TableBody.svelte"
import Tabs from "../../components/Tabs.svelte"
import TabTitles from "../../components/TabTitles.svelte"
import TabTitle from "../../components/TabTitle.svelte"
import TabContents from "../../components/TabContents.svelte"
import TabContent from "../../components/TabContent.svelte"
import Blocktext from "../../components/Blocktext.svelte"
export let sections
sections = ["Hello world","Another Section","Playground","Lists","Quotes","Tables","Tabs","Hint"]</script><Section><Title level={1} title="Hello world" /><Paragraph>This is the <Image src="https://gblobscdn.gitbook.com/spaces%2F-LYYAInRjOVo73nXt9Xy%2Favatar.png?alt=media" alt="logo" inline/> <Bold>Clio</Bold> <Italic>documentation</Italic> generator!</Paragraph><Paragraph>This should be in a separate paragraph! <Link href="https://google.com">link</Link></Paragraph><Image src="https://images.pexels.com/photos/1025469/pexels-photo-1025469.jpeg" alt="image"/></Section><Section><Title level={2} title="Another Section" /><Paragraph>You can install > clio using the <Code code="npm i -g clio" inline/> command:</Paragraph><Code code={`npm i -g clio`} language="bash"/></Section><Section><Title level={2} title="Playground" /><Code code={`export fn main argv:
  console.log "Hello world"`} language="clio"/></Section><Section><Title level={2} title="Lists" /><List bullet="bullet"><ListItem>this</ListItem><ListItem>is<List bullet="numeric"><ListItem>a</ListItem><ListItem>b</ListItem><ListItem>c</ListItem></List></ListItem><ListItem>list</ListItem></List></Section><Section><Title level={2} title="Quotes" /><Blockquote><Bold>Clio</Bold> is great :)</Blockquote></Section><Section><Title level={2} title="Tables" /><Table><TableHead><TableRow><TableHeadCell left> head</TableHeadCell><TableHeadCell center>center</TableHeadCell><TableHeadCell right>head </TableHeadCell></TableRow></TableHead><TableBody><TableRow><TableCell left> body</TableCell><TableCell center>body</TableCell><TableCell right>body </TableCell></TableRow><TableRow><TableCell left> body</TableCell><TableCell center>body</TableCell><TableCell right>body </TableCell></TableRow><TableRow><TableCell left> body</TableCell><TableCell center>body</TableCell><TableCell right>body </TableCell></TableRow></TableBody></Table></Section><Section><Title level={2} title="Tabs" /><Tabs><TabTitles><TabTitle>clio.toml</TabTitle><TabTitle>main.clio</TabTitle></TabTitles><TabContents><TabContent><Code code={`[build]
src = "src"
destination = "dest"`} language="toml"/></TabContent><TabContent><Code code={`export fn main argv:
  console.log argv`} language="js"/></TabContent></TabContents></Tabs></Section><Section><Title level={2} title="Hint" /><Blocktext type={"info"}>Just for your info!</Blocktext><Blocktext type={"exclamation"}>DANGER!</Blocktext><Blocktext type={"question"}>How do I do that?</Blocktext></Section><Blocktext type={"check"}>Congrats!</Blocktext>