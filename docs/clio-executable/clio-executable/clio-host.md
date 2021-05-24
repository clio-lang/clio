# clio host

To host a Clio project you can run the following command in the root directory of your Clio project:

```text
clio host [directory]
```

In the above command, `directory` is optional, and defaults to current working directory. Please refer to Parallelism [Configuration](../../reference/parallelism/parallelism.md) section to learn how to configure the host functionality.

## Overriding the default host configuration

There are two ways to override the default host configuration, first one is to use a different config file:

```text
clio host [directory] --config=path-to-config-file.toml
```

The config file should be the same format as the Parallelism [Configuration](../../reference/parallelism/parallelism.md).

Second way is to configure it on the command line:

```text
clio host [directory] [protocol] --server? --workers? --host? --port? --url?
```

Please run `clio host -h` to learn more about each of the above options. Below you can see a few examples:

### Start a tcp server

```text
clio host . tcp --server
```

The above command makes a tcp server, and no workers. The server uses the default tcp configuration \(bind to `0.0.0.0` and listen to port `4444` \), to change that you can run:

```text
clio host . tcp --server --host 192.168.1.100 --port 1337
```

### Spawn workers

Workers need to connect to a dispatcher so connection arguments must be provided:

```text
clio host . tcp --workers=cpu --host 192.168.1.100 --port 1337
```

use `--path` option for IPC and `--url` for web socket connections.

