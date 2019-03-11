from flask import Flask, url_for
from flask import Response
from flask import request

from clio import clio, ClioJSONEncoder, ClioJSONDecoder

app = Flask(__name__)
app.json_encoder = ClioJSONEncoder

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

@app.route('/python/execute', methods = ['POST'])
def do_exec():
    if request.headers['Content-Type'] == 'application/clio-cloud-call':
        data = ClioJSONDecoder.decode(request.data.decode('utf8'))
        name_space = 'python'
        fn_name = data['fn_name']
        fn = name_spaces[name_space][fn_name]
        args = data['args']
        kwargs = data['kwargs']

        res = fn(*args, **kwargs)
        resp = Response(res, status=200, mimetype='application/json')
        return resp

if __name__ == '__main__':
    app.run(port=5000)
