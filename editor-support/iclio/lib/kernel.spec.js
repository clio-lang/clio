/*
 * BSD 3-Clause License
 *
 * Copyright (c) 2017, Nicolas Riesco and others as credited in the AUTHORS file
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors
 * may be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

var assert = require("assert");
var console = require("console");
var crypto = require("crypto");
var fs = require("fs");
var os = require("os");
var path = require("path");
var spawn = require("child_process").spawn;
var uuid = require("uuid");

var jmp = require("jmp");
var zmq = jmp.zmq;

// Setup logging helpers
var LABEL = "ICLIO-KERNEL: TEST";
var log;
var dontLog = function dontLog() {};
var doLog = function doLog() {
    process.stderr.write(LABEL);
    console.error.apply(this, arguments);
};

if (process.env.DEBUG) {
    global.DEBUG = true;

    try {
        doLog = require("debug")(LABEL);
    } catch (err) {}
}

log = global.DEBUG ? doLog : dontLog;

/**
 * @typedef     {Object} Message
 * @description IPython/Jupyter message
 *
 * @property    {Array}   [message.idents]        Identities
 * @property    {Object}  [message.header]        Header
 * @property    {Object}  [message.parent_header] Parent header
 * @property    {Object}  [message.metadata]      Message metadata
 * @property    {Object}  [message.content]       Message content
 */

/**
 * Callback to handle kernel messages
 *
 * @callback  onMessageCallback
 * @param    {string}  socketName Socket name
 * @param    {Message} message    IPython/Jupyter message
 */

/* eslint-disable max-len */
/**
 * @class     Context
 * @classdesc Context shared by tests
 *            (adapted from MessagingTestEngine in IJavascript)
 *            @see {@link https://github.com/n-riesco/ijavascript/tree/9c2cf6a94575b5016b4a6f3cbe380ab1fcfbcf76}
 * @param {string} protocolVersion Messaging protocol version
 */
function Context(protocolVersion) {
/* eslint-disable max-len */

    /**
     * @member          version
     * @member {String} version.protocol Messaging protocol version
     */
    this.version = {
        protocol: protocolVersion || "5.1",
    };

    /**
     * @member          path
     * @member {String} path.node           Path to node
     * @member {String} path.root           Path to package folder
     * @member {String} path.kernel         Path to kernel
     * @member {String} path.connectionFile Path to kernel connection file
     */
    this.path = {};

    /**
     * @member           connection
     * @member {String}  connection.transport    Transport protocol (e.g. "tcp")
     * @member {String}  connection.ip           IP address (e.g. "127.0.0.1")
     * @member {String}  connection.signature_scheme
     *                                           Signature scheme
     *                                           (e.g. "hmac-sha256")
     * @member {String}  connection.key          Hashing key (e.g. uuid.v4())
     * @member {Integer} connection.hb_port      HeartBeat port
     * @member {Integer} connection.shell_port   Shell port
     * @member {Integer} connection.stdin_port   Stdin port
     * @member {Integer} connection.iopub_port   IOPub port
     * @member {Integer} connection.control_port Control port
     */
    this.connection = {};

    /**
     * @member                     socket
     * @member {module:jmp~Socket} socket.control Control socket
     * @member {module:jmp~Socket} socket.hb      HearBeat socket
     * @member {module:jmp~Socket} socket.iopub   IOPub socket
     * @member {module:jmp~Socket} socket.shell   Shell socket
     * @member {module:jmp~Socket} socket.stdin   Stdin socket
     */
    this.socket = {};

    /**
     * @member      {module:child_process~ChildProcess} kernel
     * @description Kernel instance
     */
    this.kernel = null;

    /**
     * @member      {onMessageCallback} [onMessage]
     * @description Callback to handle kernel messages
     */
    this.onMessage = null;
}

/**
 * @method      init
 * @param       {function} done
 * @description Initialise the messaging test engine
 */
Context.prototype.init = function(done) {
    this._setPaths();
    this._initSockets();
    this._createConnectionFile();
    this._initKernel(done);
};

/**
 * @method      dispose
 * @description Dispose the messaging test engine
 */
Context.prototype.dispose = function() {
    this._disposeKernel();
    this._removeConnectionFile();
    this._disposeSockets();
};

/**
 * @method      _setPaths
 * @description Set up paths
 * @private
 */
Context.prototype._setPaths = function() {
    log("Setting paths");

    this.path.node = process.argv[0];
    this.path.root = path.dirname(__dirname);
    this.path.kernel = path.join(this.path.root, "lib", "kernel.js");

    this.path.connectionFile = path.join(
        os.tmpdir(),
        "conn-" + uuid.v4() + ".json"
    );
};

/**
 * @method      _createConnectionFile
 * @description Create connection file
 * @private
 */
Context.prototype._createConnectionFile = function() {
    log("Creating connection file");

    fs.writeFileSync(
        this.path.connectionFile,
        JSON.stringify(this.connection)
    );
};

/**
 * @method      _removeConnectionFile
 * @description Remove connection file
 * @private
 */
Context.prototype._removeConnectionFile = function() {
    log("Removing connection file");

    try {
        fs.unlinkSync(this.path.connectionFile);
    } catch (e) {
        console.error(e.message);
    }
};

/**
 * @method      _initSockets
 * @description Setup ZMQ sockets and message listeners
 * @private
 */
Context.prototype._initSockets = function() {
    log("Setting up ZMQ sockets");

    var transport = "tcp";
    var ip = "127.0.0.1";
    var address = transport + "://" + ip + ":";
    var scheme = "sha256";
    var key = crypto.randomBytes(256).toString("base64");

    this.connection = {
        transport: transport,
        ip: ip,
        signature_scheme: "hmac-" + scheme,
        key: key,
    };

    var socketNames = ["hb", "shell", "stdin", "iopub", "control"];
    var socketTypes = ["req", "dealer", "dealer", "sub", "dealer"];
    for (var i = 0, attempts = 0; i < socketNames.length; attempts++) {
        var socketName = socketNames[i];
        var socketType = socketTypes[i];
        var socket = (socketName === "hb") ?
            new zmq.Socket(socketType) :
            new jmp.Socket(socketType, scheme, key);
        var port = Math.floor(1024 + Math.random() * (65536 - 1024));

        try {
            socket.connect(address + port);
            this.connection[socketName + "_port"] = port;
            this.socket[socketName] = socket;
            i++;
        } catch (e) {
            log(e.stack);
        }

        if (attempts >= 100) {
            throw new Error("can't bind to any local ports");
        }
    }

    this.socket.iopub.subscribe("");

    log("Setting up message listeners");

    Object.getOwnPropertyNames(this.socket).forEach((function(socketName) {
        this.socket[socketName]
            .on("message", this._onMessage.bind(this, socketName));
    }).bind(this));
};

/**
 * @method      _disposeSockets
 * @description Dispose ZMQ sockets
 * @private
 */
Context.prototype._disposeSockets = function() {
    log("Disposing ZMQ sockets");

    this.socket.control.close();
    this.socket.hb.close();
    this.socket.iopub.close();
    this.socket.shell.close();
    this.socket.stdin.close();
};

/**
 * @method      _initKernel
 * @description Setup IJavascript kernel
 * @param       {function} done
 * @private
 */
Context.prototype._initKernel = function(done) {
    log("Initialising a kernel");

    var cmd = this.path.node;
    var args = [
        this.path.kernel,
        "--protocol=" + this.version.protocol,
        this.path.connectionFile,
    ];
    if (global.DEBUG) args.push("--debug");
    var config = {
        stdio: "inherit"
    };
    log("spawn", cmd, args, config);
    this.kernel = spawn(cmd, args, config);

    if (done) {
        this._waitUntilConnect(function() {
            this._waitUntilKernelIsIdle(done);
        }.bind(this));
    }
};

/**
 * @method      _disposeKernel
 * @description Dispose IJavascript kernel
 * @private
 */
Context.prototype._disposeKernel = function() {
    log("Disposing IJavascript kernel");

    if (this.kernel) {
        this.kernel.kill("SIGTERM");
    }
};

/**
 * @method      _waitUntilConnect
 * @description Wait for ZMQ sockets to connect
 * @param       {function} done
 * @private
 */
Context.prototype._waitUntilConnect = function(done) {
    log("Waiting for ZMQ sockets to connect");

    var socketNames = ["hb", "shell", "iopub", "control"];

    var waitGroup = socketNames.length;
    function onConnect() {
        waitGroup--;
        if (waitGroup === 0) {
            for (var i = 0; i < socketNames.length; i++) {
                this.socket[socketNames[i]].unmonitor();
            }
            if (done) done();
        }
    }

    for (var j = 0; j < socketNames.length; j++) {
        this.socket[socketNames[j]].on("connect", onConnect.bind(this));
        this.socket[socketNames[j]].monitor();
    }
};

/**
 * @method      _waitUntilKernelIsIdle
 * @description Wait until kernel is idle
 * @param       {function} done
 * @private
 */
Context.prototype._waitUntilKernelIsIdle = function(done) {
    log("Waiting until kernel is idle");

    var onMessage = this.onMessage;

    var request = this.run("", function(socketName, response) {
        if (response.parent_header.msg_id !== request.header.msg_id) {
            return;
        }

        if (socketName === "iopub") {
            if (response.header.msg_type === "status") {
                if (response.content.execution_state === "idle") {
                    this.onMessage = onMessage;
                    if (done) done();
                }
            }
        }
    });
};

/**
 * @method      _onMessage
 * @description Handle kernel message
 * @param       {string}  socketName Socket name
 * @param       {Message} message    IPython/Jupyter message
 * @private
 */
Context.prototype._onMessage = function(socketName, message) {
    log("Received on " + socketName, message);

    if (this.onMessage) this.onMessage(socketName, message);
};

/**
 * @method      run
 * @description Send kernel an execution request
 *
 * @param       {string}            code        Code to be run by kernel
 * @param       {onMessageCallback} [onMessage] Kernel message handler
 *
 * @returns     {Message}           message     IPython/Jupyter message
 */
Context.prototype.run = function(code, onMessage) {
    log("Running:", code);

    var message = {
        "header": {
            "msg_type": "execute_request"
        },
        "content": {
            "code": code
        }
    };

    if (!(message instanceof jmp.Message)) {
        message = new jmp.Message(message);
    }

    if (!message.header.msg_id) {
        message.header.msg_id = uuid.v4();
    }

    if (!message.header.username) {
        message.header.username = "user";
    }

    if (!message.header.session) {
        message.header.session = uuid.v4();
    }

    if (!message.header.version) {
        message.header.version = this.version.protocol;
    }

    this.onMessage = onMessage;
    this.socket.shell.send(message);

    return message;
};

describe("iclio-kernel", function() {
    var ctx = new Context();

    before(function(done) {
        this.timeout(5000);
        ctx.init(done);
    });

    after(function() {
        ctx.dispose();
    });

    it("can run: console.log 'Hello, World!'", function(done) {
        test("console.log 'Hello, World!'", "Hello, World!\n", done);
    });

    it("uses clio@1", function(done) {
        var code = [
            "outer = ->",
            "  inner = => Array.prototype.slice.call arguments",
            "  inner()",
            "",
            "console.log outer(1, 2)",
        ].join("\n");

        var stdout = "[]\n";

        test(code, stdout, done);
    });

    function test(code, stdout, done) {
        var receivedExecuteReply = false;
        var receivedStdout = false;

        var requestMessage = ctx.run(code, function(socketName, message) {
            if (message.parent_header.msg_id !== requestMessage.header.msg_id) {
                return;
            }

            var msg_type = message && message.header && message.header.msg_type;

            if (socketName === "shell") {
                if (msg_type === "execute_reply") {
                    receivedExecuteReply = true;
                }
            } else if (socketName === "iopub") {
                if (msg_type === "stream") {
                    var name = message.content.name;
                    if (name === "stdout") {
                        var text = (message.content.hasOwnProperty("text")) ?
                            message.content.text :
                            message.content.data;
                        assert.equal(text, stdout, "Unexpected stdout");
                        receivedStdout = true;
                    }
                }
            }

            if (receivedExecuteReply && receivedStdout) {
                ctx.onMessage = null;
                done();
            }
        });
    }
});
