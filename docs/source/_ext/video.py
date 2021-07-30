from docutils import nodes
from docutils.parsers.rst import Directive
from docutils.parsers.rst import directives
import urllib.parse
import mimetypes


def video(src, alt, autoplay, controls, loop, muted):
    mime = mimetypes.MimeTypes().guess_type(src)[0]
    params = 'frameborder="0" width="100%"'
    params += autoplay and "autoplay " or ""
    params += controls and "controls " or ""
    params += loop and "loop " or ""
    params += muted and "muted " or ""
    video = f'<video {params}><source src="{src}" type="{mime}">{alt}</video >'
    return video


class Video(Directive):

    has_content = True
    required_arguments = 1
    optional_arguments = 0
    final_argument_whitespace = False
    option_spec = {'autoplay': directives.flag,
                   'controls': directives.flag,
                   'loop': directives.flag,
                   'muted': directives.flag,
                   'alt': directives.unchanged,
                   }

    def run(self):
        src = self.arguments[0]
        alt = 'alt' in self.options and self.options['alt'] or ""
        autoplay = 'autoplay' in self.options
        controls = 'controls' in self.options
        loop = 'loop' in self.options
        muted = 'muted' in self.options
        raw = video(src, alt, autoplay, controls, loop, muted)
        node = nodes.raw("", raw, format='html')
        return [node]


def setup(app):
    app.add_directive("video", Video)

    return {
        'version': '0.1',
        'parallel_read_safe': True,
        'parallel_write_safe': True,
    }
