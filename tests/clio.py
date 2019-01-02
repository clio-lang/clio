from flask import Flask, url_for
from flask import Response
from flask import request

app = Flask(__name__)

import io
import json
from contextlib import redirect_stdout

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

@clio
def hello(person):
    print(f'hello {person}!')
    print(f'hello from Python!')
    return person

@clio
def double(n):
    return n*2

name_spaces = {
    'python': {
        'hello': hello,
        'double': double
    }
}

@app.route('/python', methods = ['GET'])
def python_namespace():

    #if request.headers['Content-Type'] == 'text/plain':
        #res = json.dumps(list(name_spaces[request.data].keys()))
    res = json.dumps(list(name_spaces['python'].keys()))
    resp = Response(res, status=200, mimetype='application/json')
    return resp

@app.route('/python/execute', methods = ['POST'])
def do_exec():
    if request.headers['Content-Type'] == 'application/clio-cloud-call':
        data = json.loads(request.data)
        name_space = 'python'
        fn_name = data['fn_name']
        fn = name_spaces[name_space][fn_name]
        args = data['args']
        kwargs = data['kwargs']

        res = fn(*args, **kwargs)
        resp = Response(res, status=200, mimetype='application/json')
        return resp

    #elif request.headers['Content-Type'] == 'application/octet-stream':
    #    f = open('./binary', 'wb')
    #    f.write(request.data)
    #            f.close()
    #    return "Binary message written!"
    #
    #else:
    #    return "415 Unsupported Media Type ;)"

if __name__ == '__main__':
    app.run()
