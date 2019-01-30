const express = require('express')
const app = express()
const port = 3000 // FIXME

app.get('/', (req, res) => {
  if (!req.query.code) {
    return res.status(400).send('You need to provide the code!')
  }
  // FIXME: better templating perhaps
  var data = req.query.code.replace(/\-/g, "+").replace(/_/g, "/");
  var text = Buffer.from(data, 'base64').toString('utf8');
  var code = `<div class="clio-code"><pre>${text}</pre></div>`
  var script = `<script src="http://clio-oembed.pouya.ch/static/highlight.js"/>`
  var css = `<link rel="stylesheet" href="http://clio-oembed.pouya.ch/static/oembed.css" />`
  var font = `<link rel="stylesheet" href="http://clio-oembed.pouya.ch/fonts/fira_code.css">`
  var page = `<html>
    <head>
      <meta content="">
      ${css}
      ${font}
    </head>
    <body>
      <div class="wrapper">
        ${code}
      </div>
      <div class="info-bar">
        Rendered by Clio oEmbed service.
        Check <a href="https://github.com/pouya-eghbali/clio"> Clio repo </a> for more info.
      </div>
      ${script}
    </body>
</html>`
  var oembed = {
    type: 'rich',
    version: '1.0',
    html: page,
    width: '700',
    height: '300',
  }
  // TODO: add xml support
  res.json(oembed);
})

app.use('/static', express.static('static'))
app.use('/fonts', express.static('../../editor/fonts'))
app.listen(port, () => console.log(`Clio oembed listening on port ${port}!`))
