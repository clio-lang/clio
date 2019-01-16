from pygments.lexer import RegexLexer
from pygments.token import *

class ClioLexer(RegexLexer):
    name = 'Clio'
    aliases = ['clio']
    filenames = ['*.clio']

    tokens = {
        'root': [
            (r'=>', Keyword.Declaration),
            (r'-> *\*?', Operator),
            (r'my|self', Name.Builtin.Pseudo),
            (r'type|fn|transform|if|else|elif', Keyword),
            (r'true|false', Keyword.Pseudo),
            (r'(0|-?[1-9][0-9\']*)(\.[0-9\']+)?', Number),
            (r'[-+*/^%]', Operator),
            (r'not|and|or', Operator.Word),
            (r'[[\]():@]|\.', Punctuation),
            (r'--.*[\r\n]', Comment.Single),
            (r'import', Keyword.Namespace),
            (r'print', Name.Builtin),
            # only fixed width look-behid! great.
            (r'(?<=@)[^ \n\r\t]+', Name.Decorator),
            (r'(?<!-> )(?<=fn )[^ \n\r\t:]+', Name.Function),
            (r'(?<!-> \* )(?<=fn )[^ \n\r\t:]+', Name.Function),
            (r'(?<!->\* )(?<=fn )[^ \n\r\t:]+', Name.Function),
            (r'(?<=type )[^ \n\r\t:]+', Name.Class),
            (r'(?<==> )[^ \n\r\t:]+', Name.Variable),
            (r'[a-z$_][a-z_0-9$-]*', Name),
            (r'#[^# \n\r\t:]+', String.Symbol),
            (r'\'(.*|\\.)\'', String.Single),
        ]
    }

if __name__ == '__main__':
    from pygments import highlight
    from pygments.formatters import ImageFormatter
    from PIL import Image
    from io import BytesIO

    code = '''\
fn identity-matrix n:
  0..n -> * fn i:
    0..n -> * if = i: 1
                else: 0

5 -> identity-matrix -> * print
'''
    formatter = ImageFormatter(font_name='Fira Code', style='monokai', font_size=16)
    image_data = highlight(code, ClioLexer(), formatter)
    image = Image.open(BytesIO(image_data))
    image.show()
