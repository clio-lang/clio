
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var routes = {
	"v0.9.0": [
		{
			filename: "./routes/v0.9.0/index.svelte",
			title: "Hello world"
		}
	]
};
var index = {
	"v0.9.0": {
		sections: [
			{
				title: "Hello world",
				text: "This is the Clio documentation generator! This should be in a separate paragraph! link "
			},
			{
				title: "Another Section",
				text: "You can install > clio using the command: "
			},
			{
				title: "Playground",
				text: ""
			},
			{
				title: "Lists",
				text: "this is a b c list "
			},
			{
				title: "Quotes",
				text: "Clio is great :) "
			},
			{
				title: "Tables",
				text: "| head | center | head | | body | body | body | | body | body | body | | body | body | body | "
			},
			{
				title: "Tabs",
				text: ""
			},
			{
				title: "Hint",
				text: "Just for your info! DANGER! How do I do that? Congrats! "
			}
		]
	}
};
var urls = {
	"v0.9.0": "./routes/v0.9.0/index.svelte"
};
var v0_9_0 = {
	routes: routes,
	index: index,
	urls: urls
};

export default v0_9_0;
export { index, routes, urls };
//# sourceMappingURL=v0.9.0-0dceb180.js.map
