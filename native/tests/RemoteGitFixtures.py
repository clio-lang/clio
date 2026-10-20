"""Controlled smart HTTP/TLS Git servers; no external host or user credentials."""
import argparse
import http.server
import json
import os
from pathlib import Path
import shutil
import ssl
import subprocess
import threading
import time
import tomllib
from urllib.parse import urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('--api', required=True)
parser.add_argument('--compiler', required=True)
parser.add_argument('--checker', required=True)
parser.add_argument('--root', required=True)
parser.add_argument('--metal')
parser.add_argument('--cmake')
parser.add_argument('--build')
parser.add_argument('--config')
args = parser.parse_args()
root = Path(args.root).absolute().resolve()
if root.exists():
    shutil.rmtree(root)
root.mkdir(parents=True)
repositories = root / 'repositories'
repositories.mkdir()
env = {**os.environ, 'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null',
       'GIT_AUTHOR_NAME': 'Fixture', 'GIT_AUTHOR_EMAIL': 'fixture@example.invalid',
       'GIT_COMMITTER_NAME': 'Fixture', 'GIT_COMMITTER_EMAIL': 'fixture@example.invalid'}

def run(*command, ok=True):
    result = subprocess.run(list(map(str, command)), env=env, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=60)
    assert not any(s in result.stderr for s in [b'ERROR: AddressSanitizer', b'runtime error:',
                                               b'WARNING: ThreadSanitizer']), result.stderr
    assert (result.returncode == 0) == ok, (command, result.returncode, result.stdout, result.stderr)
    return result

def git(path, *command):
    return run('/usr/bin/git', '-C', path, *command).stdout.decode().strip()

requests = []
request_lock = threading.Lock()
stopped = threading.Event()
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *unused):
        pass

    def do_GET(self):
        self.respond()

    def do_POST(self):
        self.respond()

    def respond(self):
        path = urlsplit(self.path)
        with request_lock:
            requests.append(path.path)
        if path.path.startswith('/redirect/'):
            self.send_response(302)
            self.send_header('Location', f'http://127.0.0.1:{self.server.server_port}/forbidden/geometry.git/info/refs?service=git-upload-pack')
            self.end_headers()
            return
        if path.path.startswith('/auth/'):
            self.send_response(401)
            self.send_header('WWW-Authenticate', 'Basic realm="fixture"')
            self.end_headers()
            return
        if path.path.startswith('/stall/'):
            stopped.wait(4)
            self.send_response(503)
            self.end_headers()
            return
        if path.path.startswith('/malformed/'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/x-git-upload-pack-advertisement')
            self.end_headers()
            self.wfile.write(b'not a git packet')
            return
        body = self.rfile.read(int(self.headers.get('Content-Length', '0')))
        backend = subprocess.run(['/usr/bin/git', 'http-backend'], input=body, capture_output=True,
            env={**env, 'GIT_PROJECT_ROOT': str(repositories), 'GIT_HTTP_EXPORT_ALL': '1',
                 'PATH_INFO': path.path, 'QUERY_STRING': path.query, 'REQUEST_METHOD': self.command,
                 'CONTENT_TYPE': self.headers.get('Content-Type', ''), 'CONTENT_LENGTH': str(len(body)),
                 'REMOTE_ADDR': '127.0.0.1'}, timeout=15)
        headers, separator, payload = backend.stdout.partition(b'\r\n\r\n')
        assert separator, backend.stderr
        status = 200
        pairs = []
        for line in headers.decode().split('\r\n'):
            name, value = line.split(':', 1)
            if name.lower() == 'status':
                status = int(value.strip().split()[0])
            else:
                pairs.append((name, value.strip()))
        self.send_response(status)
        for name, value in pairs:
            self.send_header(name, value)
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        try:
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            pass

class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True

http = Server(('127.0.0.1', 0), Handler)
https = Server(('127.0.0.1', 0), Handler)
ca = root / 'ca.pem'
key = root / 'key.pem'
configuration = root / 'openssl.cnf'
configuration.write_text('[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=extensions\n'
                         '[dn]\nCN=Kalandra local transport fixture\n[extensions]\n'
                         'basicConstraints=critical,CA:true\nsubjectAltName=IP:127.0.0.1\n'
                         'keyUsage=critical,digitalSignature,keyEncipherment,keyCertSign\n')
run('/usr/bin/openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-config', configuration, '-keyout', key, '-out', ca)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(ca, key)
https.socket = context.wrap_socket(https.socket, server_side=True)
for server in [http, https]:
    threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{http.server_port}'
tls = f'https://127.0.0.1:{https.server_port}'

def repository(name, source, dependencies='', extra=None):
    work = root / (name + '-work')
    work.mkdir()
    git(work, 'init', '--template=', '--initial-branch=main')
    (work / 'kalandra.toml').write_text("format=1\n[package]\nname='fixture'\nversion='0.1.0'\nentry='public.k'\n" +
                                      ('[dependencies]\n' + dependencies if dependencies else ''))
    (work / 'public.k').write_text(source)
    (work / '.gitattributes').write_text('raw.txt export-subst\n*.k filter=attack\n')
    (work / 'raw.txt').write_text('$Format:%H$\n')
    if extra:
        extra(work)
    git(work, 'add', '--all')
    git(work, 'commit', '-m', 'fixture')
    revision = git(work, 'rev-parse', 'HEAD')
    run('/usr/bin/git', 'clone', '--bare', '--no-hardlinks', work, repositories / (name + '.git'))
    return revision

def request(name, url, revision):
    return f'{name}={{git={json.dumps(url)},rev={json.dumps(revision)}}}\n'

simple = 'export fn next(n:int64)->int64:\n  n+1\n'
first = repository('geometry', simple)
parent = repository('parent', 'from "geometry" import next\nexport fn compute(n:int64)->int64:\n  next(n)\n',
                    request('geometry', base + '/geometry.git', first))
large = repository('large', simple, extra=lambda path: (path / 'large.bin').write_bytes(os.urandom(1024 * 1024)))
unsafe = repository('unsafe', simple, extra=lambda path: (path / 'link.k').symlink_to('public.k'))
local = repository('local-dependency', simple, request('private', str(root / 'private'), first))
numerical = repository('numerical', 'export fn shift(values:Tensor[float32,?])->Tensor[float32,?]:\n  values+1\n')
app = root / 'application'
app.mkdir()
(app / 'main.k').write_text('from "parent" import compute\nfn main()->int64 ! TaskError:\n  try parallel:\n    try await spawn compute(41)\n')
manifest = app / 'kalandra.toml'
manifest.write_text("format=1\n[project]\nentry='main.k'\n[dependencies]\n" + request('parent', base + '/parent.git', parent))

def api(mode, cache, url, revision=first, certificate='-', budget='normal', ok=True):
    return run(args.api, mode, cache, url, revision, certificate, budget, ok=ok)

try:
    # Inherited Git config, proxy/TLS and askpass settings must not reach fetch.
    marker = root / 'executed'
    env.update({'GIT_CONFIG_COUNT': '3', 'GIT_CONFIG_KEY_0': 'core.fsmonitor',
                'GIT_CONFIG_VALUE_0': f'!touch {marker}', 'GIT_CONFIG_KEY_1': 'url.file:///bad.insteadOf',
                'GIT_CONFIG_VALUE_1': base, 'GIT_CONFIG_KEY_2': 'http.proxy',
                'GIT_CONFIG_VALUE_2': 'http://127.0.0.1:1', 'GIT_SSL_NO_VERIFY': '1',
                'HTTPS_PROXY': 'http://127.0.0.1:1', 'ALL_PROXY': 'http://127.0.0.1:1',
                'GIT_ASKPASS': str(marker)})
    for url in ['https://github.com/team/repo.git', base + '/geometry.git']:
        api('validate', root, url)
    for url in ['http://example.com/a.git', 'http://localhost:123/a.git', 'git://example.com/a',
                'ssh://example.com/a', 'git@example.com:a', 'file:///tmp/a', 'ext::touch-marker',
                'https://user:pass@example.com/a', 'https://example.com/a?token=x',
                'https://example.com/a#x', 'https://example.com/a%2fb', 'https://EXAMPLE.com/a',
                'https://example.com/../a', 'https://example.com//a', 'https://example.com/a/',
                'https://example.com:443/a', 'https://example.com:0001/a', 'https://example.com:99999/a',
                'https://example.com./a', 'https://example.com/a\n']:
        api('validate', root, url, ok=False)
    # Strict TLS is the default despite hostile ambient verification settings.
    untrusted = root / 'untrusted'
    api('install', untrusted, tls + '/geometry.git', ok=False)
    assert not list(untrusted.iterdir())
    trusted = root / 'trusted'
    trusted_result = api('install', trusted, tls + '/geometry.git', certificate=ca).stdout
    assert trusted_result.startswith(b'git-remote-v1:')
    assert next(trusted.glob('*/source/raw.txt')).read_text() == '$Format:%H$\n'
    wrong_host = root / 'wrong-host'
    api('install', wrong_host, f'https://localhost:{https.server_port}/geometry.git', certificate=ca, ok=False)
    assert not list(wrong_host.iterdir())
    tls_app = root / 'tls-application'
    tls_app.mkdir()
    tls_manifest = tls_app / 'kalandra.toml'
    tls_manifest.write_text("format=1\n[project]\nentry='main.k'\n[dependencies]\n" + request('geometry', tls + '/geometry.git', first))
    (tls_app / 'main.k').write_text('from "geometry" import next\nfn main()->int64 ! TaskError:\n  try parallel:\n    try await spawn next(41)\n')
    run(args.compiler, 'install', '--project', tls_manifest, ok=False)
    assert not (tls_app / '.kalandra/installed.toml').exists()
    api('project', tls_manifest, tls + '/geometry.git', certificate=ca)
    # Installation from remote source must reject source links and local dependencies.
    for name, revision in [('unsafe', unsafe), ('local-dependency', local)]:
        cache = root / (name + '-cache')
        api('install', cache, base + '/' + name + '.git', revision, ok=False)
        assert not list(cache.iterdir())
    for name, url, revision, budget in [
        ('redirect', base + '/redirect/repo.git', first, 'normal'),
        ('auth', base + '/auth/repo.git', first, 'normal'),
        ('malformed', base + '/malformed/repo.git', first, 'normal'),
        ('timeout', base + '/stall/repo.git', first, 'timeout'),
        ('missing', base + '/geometry.git', 'f' * 40, 'normal'),
        ('bytes', base + '/large.git', large, 'bytes'),
        ('entries', base + '/geometry.git', first, 'entries'),
        ('source', base + '/geometry.git', first, 'source'),
        ('listing', base + '/geometry.git', first, 'listing')]:
        cache = root / (name + '-cache')
        start = time.monotonic()
        api('install', cache, url, revision, budget=budget, ok=False)
        assert time.monotonic() - start < 15
        assert not list(cache.iterdir()), (name, list(cache.iterdir()))
    assert not any(path.startswith('/forbidden/') for path in requests)
    # Public CLI installs a complete transitive graph. Failed extension keeps it active.
    run(args.compiler, 'install', '--project', manifest)
    run(args.checker, '--project', manifest)
    active = app / '.kalandra/installed.toml'
    original = active.read_bytes()
    assert len(tomllib.loads(original.decode())['snapshots']) == 2
    text = manifest.read_text()
    manifest.write_text(text + request('missing', base + '/missing.git', first))
    run(args.compiler, 'install', '--project', manifest, ok=False)
    assert active.read_bytes() == original
    manifest.write_text(text)
    if args.metal:
        gpu_app = root / 'gpu-application'
        gpu_app.mkdir()
        gpu_manifest = gpu_app / 'kalandra.toml'
        gpu_manifest.write_text("format=1\n[project]\nentry='main.k'\n[dependencies]\n" + request('numerical', base + '/numerical.git', numerical))
        (gpu_app / 'main.k').write_text('from "numerical" import shift\nfn main()->float32 ! TaskError:\n  try parallel:\n    gpu=devices.gpu()\n    values:Tensor[float32,3]=tensor([1,2,3])\n    resident=try await transfer(values,gpu)\n    changed=try await spawn shift(resident) on gpu\n    host=try await transfer(changed,devices.cpu())\n    reduceSum(host)\n')
        run(args.compiler, 'install', '--project', gpu_manifest)
    if args.build:
        prefix = root / 'compiler installation'
        run(args.cmake, '--install', args.build, '--config', args.config,
            '--component', 'NativeCPUCompiler', '--prefix', prefix)
        installed_prefix = root / 'relocated compiler'
        prefix.rename(installed_prefix)
        installed = installed_prefix / 'bin/kalandra'
        installed_app = root / 'installed application'
        installed_app.mkdir()
        installed_manifest = installed_app / 'kalandra.toml'
        installed_manifest.write_text(text)
        (installed_app / 'main.k').write_bytes((app / 'main.k').read_bytes())
        run(installed, 'install', '--project', installed_manifest)
    assert not marker.exists()
finally:
    stopped.set()
    for server in [http, https]:
        server.shutdown()
        server.server_close()

# No network service remains. Neither loads, explicit reuse, checking nor builds fetch.
observed = len(requests)
assert api('load', trusted, tls + '/geometry.git').stdout == trusted_result
assert api('install', trusted, tls + '/geometry.git').stdout == trusted_result
run(args.compiler, 'install', '--project', manifest)
assert active.read_bytes() == original
run(args.checker, '--project', manifest)
run(args.checker, '--project', tls_manifest)
run(args.compiler, '--project', tls_manifest, '-o', tls_app / 'program')
assert run(tls_app / 'program').stdout == b'42\n'
if args.metal:
    run(args.checker, '--placement', '--project', gpu_manifest)
    run(args.metal, '--project', gpu_manifest, '-o', gpu_app / 'emitted')
    assert (gpu_app / 'emitted/kernel0.mlir').exists()
if args.build:
    run(installed, '--project', installed_manifest, '-o', installed_app / 'program')
    assert run(installed_app / 'program').stdout == b'42\n'
for mode in [[], ['-O2'], ['--sanitize'], ['--thread-sanitize']]:
    output = app / 'program'
    run(args.compiler, '--project', manifest, '-o', output, *mode)
    for workers in [1, 4]:
        env['KALANDRA_WORKERS'] = str(workers)
        assert run(output).stdout == b'42\n'
assert len(requests) == observed
# A corrupted remote snapshot is never silently fetched or repaired.
source = next(trusted.glob('*/source/public.k'))
source.write_text('corrupt')
api('install', trusted, tls + '/geometry.git', ok=False)
print('Remote Git: strict TLS and URL policy, bounded HTTP(S) fetch, transitive activation, rollback, rejection, timeout and offline workers passed')
