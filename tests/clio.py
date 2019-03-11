import io
import json
from contextlib import redirect_stdout
from flask.json import JSONEncoder, JSONDecoder

def clio(fn):
    def clio_fn(*args, **kwargs):
        with io.StringIO() as buf, redirect_stdout(buf):
            result = fn(*args, **kwargs)
            output = buf.getvalue()
        return json.dumps({
            'result': result,
            'stdout': output
        })
    return clio_fn

class ClioJSONEncoder(JSONEncoder):

    def default(self, obj):
        if isinstance(obj, int):
            return f'clio::number::{obj}'
        return JSONEncoder.default(self, obj)

def clio_parse_item(item):
    if isinstance(item, str) and item.startswith('clio::number::'):
        return int(item.strip('clio::number::'))
    if isinstance(item, list):
        return [clio_parse_item(it) for it in item]
    if isinstance(item, dict):
        return clio_parse_dict(item)
    return item

def clio_parse_dict(obj):
    for key in obj:
        obj[key]= clio_parse_item(obj[key])
    return obj

ClioJSONDecoder = json.JSONDecoder(object_hook=clio_parse_dict)
