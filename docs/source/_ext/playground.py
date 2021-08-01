from docutils import nodes
from docutils.parsers.rst import Directive
from docutils.parsers.rst import directives
import urllib.parse

icon = '<svg version="1.1" width="16" height="16" class="octicon octicon-file-code" viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="M4 1.75C4 .784 4.784 0 5.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v8.586A1.75 1.75 0 0114.25 15h-9a.75.75 0 010-1.5h9a.25.25 0 00.25-.25V6h-2.75A1.75 1.75 0 0110 4.25V1.5H5.75a.25.25 0 00-.25.25v2.5a.75.75 0 01-1.5 0v-2.5zm7.5-.188V4.25c0 .138.112.25.25.25h2.688a.252.252 0 00-.011-.013l-2.914-2.914a.272.272 0 00-.013-.011zM5.72 6.72a.75.75 0 000 1.06l1.47 1.47-1.47 1.47a.75.75 0 101.06 1.06l2-2a.75.75 0 000-1.06l-2-2a.75.75 0 00-1.06 0zM3.28 7.78a.75.75 0 00-1.06-1.06l-2 2a.75.75 0 000 1.06l2 2a.75.75 0 001.06-1.06L1.81 9.25l1.47-1.47z"></path></svg>'


def lazy_iframe(iframe):
    return f"""
        <div class="lazy-iframe" style="min-height:1px">
            <script>
                (() => {{
                    const element = document.currentScript.parentElement;
                    window.addEventListener("scroll", check);
	                window.addEventListener("DOMContentLoaded", check);
	                window.addEventListener("click", check);

                    if (element.closest(".tabbed-content")) {{
                        const label = element.closest(".tabbed-content").previousSibling
                        label.innerHTML = `{icon}` + `<span> ${{label.innerText}} </span>`
                    }}

                    function check() {{
                        setTimeout(() => {{
                            const rect = element.getBoundingClientRect();
                            const isVisible = rect.top - window.innerHeight < 500 &&
                                            rect.bottom > -50 &&
                                            rect.width > 0;

                            if (isVisible) {{
                                element.outerHTML = `{iframe}`
                            }}
                        }}, 100)
                    }}
                }})();
            </script>
        </div>
    """


def playground(code, height, interactive):
    query = urllib.parse.urlencode({"code": code})
    src = f'https://playground.clio-lang.org/?hz=true&{query}'
    if not interactive:
        src += "&run=no&examples=no&share=no&console=no"
    params = 'class="playground" loading="lazy" allow="clipboard-read; clipboard-write"'
    iframe = f'<iframe {params} src="{src}" width="100%" height="{height}px" frameborder="no"></iframe>'
    return lazy_iframe(iframe)


class Playground(Directive):

    has_content = True
    required_arguments = 0
    optional_arguments = 0
    option_spec = {'height': directives.nonnegative_int,
                   'no-interactive': directives.flag}

    def run(self):
        code = "\n".join(self.content)
        height = 'height' in self.options and self.options['height'] or 540
        interactive = 'no-interactive' not in self.options
        raw = playground(code, height, interactive)
        node = nodes.raw("", raw, format='html')
        return [node]


def setup(app):
    app.add_directive("playground", Playground)

    return {
        'version': '0.1',
        'parallel_read_safe': True,
        'parallel_write_safe': True,
    }
