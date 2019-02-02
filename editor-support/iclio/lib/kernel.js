#!/usr/bin/env node

/*
 * BSD 3-Clause License
 *
 * Copyright (c) 2015, Nicolas Riesco and others as credited in the AUTHORS file
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

var console = require("console");
var fs = require("fs");
var path = require("path");

var Kernel = require("jp-kernel");


const lexer = require('../../../lexer/lexer');
const parser = require('../../../parser/parser');
const analyzer = require('../../../evaluator/analyzer');
const beautify = require('js-beautify').js;

function compile(clio_code) {
  clio_code = `${clio_code}\n`
  var tokens = lexer(clio_code);
  if (tokens[0] == false) {
    return;
  }
  tokens = tokens[1];
  var result = parser(clio_code, tokens, false, '<jupyter-input>');
  var ast = result[1];
  ast.pop() // eof
  var code = beautify(analyzer(ast, clio_code));
  var builtins = require.resolve('../../../internals/builtins');
  code = `if (!builtins) {
    var builtins = require('${builtins}');
  }
  if (!scope) {
    var scope = {};
  }
  ${code}
  module.exports(scope, builtins, {name: "<jupyter-input>", source: \`${clio_code}\`});`;
  return code
}

// Parse command arguments
var config = parseCommandArguments();

// Setup logging helpers
var log;
var dontLog = function dontLog() {};
var doLog = function doLog() {
    process.stderr.write("KERNEL: ");
    console.error.apply(this, arguments);
};

if (process.env.DEBUG) {
    global.DEBUG = true;

    try {
        doLog = require("debug")("KERNEL:");
    } catch (err) {}
}

//log = global.DEBUG ? doLog : dontLog;
log = doLog;


// Setup session initialisation
config.startupCallback = function startupCallback() {
    var code = ``
    this.session.execute(code, {
        onSuccess: function() {
            log("startupCallback: '" + code + "' run successfuly");
        },
        onError: function() {
            log("startupCallback: '" + code + "' failed to run");
        },
    });
};


// Setup clio transpiler
config.transpile = function(code) {
    return compile(code);
};

// Start kernel
var kernel = new Kernel(config);

kernel.handlers.is_complete_request = function is_complete_request(request) {
    request.respond(this.iopubSocket, "status", {
        execution_state: "busy"
    });

    var content;
    try {
        config.transpile(request.content.code);
        content = {
            status: "complete",
        };
    } catch (err) {
        content = {
            status: "incomplete",
            indent: "",
        };
    }

    request.respond(
        this.shellSocket,
        "is_complete_reply",
        content,
        {},
        this.protocolVersion
    );

    request.respond(this.iopubSocket, "status", {
        execution_state: "idle"
    });
};

// Interpret a SIGINT signal as a request to interrupt the kernel
process.on("SIGINT", function() {
    log("Interrupting kernel");
    kernel.restart(); // TODO(NR) Implement kernel interruption
});


/**
 * Parse command arguments
 *
 * @returns {module:jp-kernel~Config} Kernel config
 */
function parseCommandArguments() {
    var config = {
        cwd: process.cwd(),
        hideUndefined: true,
        protocolVersion: "5.1",
    };

    var usage = (
        "Usage: node kernel.js " +
        "[--debug] " +
        "[--hide-undefined] " +
        "[--protocol=Major[.minor[.patch]]] " +
        "[--session-working-dir=path] " +
        "[--show-undefined] " +
        "[--startup-script=path] " +
        "connection_file"
    );

    var FLAGS = [
        ["--debug", function() {
            config.debug = true;
        }],
        ["--hide-undefined", function() {
            config.hideUndefined = true;
        }],
        ["--protocol=", function(setting) {
            config.protocolVersion = setting;
        }],
        ["--session-working-dir=", function(setting) {
            config.cwd = setting;
        }],
        ["--show-undefined", function() {
            config.hideUndefined = false;
        }],
        ["--startup-script=", function(setting) {
            config.startupScript = setting;
        }],
    ];

    try {
        var connectionFile;

        process.argv.slice(2).forEach(function(arg) {
            for (var i = 0; i < FLAGS.length; i++) {
                var flag = FLAGS[i];
                var label = flag[0];
                var action = flag[1];

                var matchesFlag = (arg.indexOf(label) === 0);
                if (matchesFlag) {
                    var setting = arg.slice(label.length);
                    action(setting);
                    return;
                }
            }

            if (connectionFile) {
                throw new Error("Error: too many arguments");
            }

            connectionFile = arg;
        });

        if (!connectionFile) {
            throw new Error("Error: missing connection_file");
        }

        config.connection = JSON.parse(fs.readFileSync(connectionFile));

    } catch (e) {
        console.error("KERNEL: ARGV:", process.argv);
        console.error(usage);
        throw e;
    }

    var nodeVersion;
    var protocolVersion;
    var jpVersion;
    var majorVersion = parseInt(config.protocolVersion.split(".")[0]);
    if (majorVersion <= 4) {
        nodeVersion = process.versions.node.split(".")
            .map(function(v) {
                return parseInt(v, 10);
            });
        protocolVersion = config.protocolVersion.split(".")
            .map(function(v) {
                return parseInt(v, 10);
            });
        config.kernelInfoReply = {
            "language": "clio",
            "language_version": '0.1',
            "protocol_version": protocolVersion,
        };
    } else {
        nodeVersion = process.versions.node;
        protocolVersion = config.protocolVersion;
        var packageJsonPath = path.join(__dirname, "..", "package.json");
        jpVersion = JSON.parse(fs.readFileSync(packageJsonPath)).version;
        config.kernelInfoReply = {
            "protocol_version": protocolVersion,
            "implementation": "iclio",
            "implementation_version": '0.1',
            "language_info": {
                "name": "clio",
                "version": "0.1",
                "mimetype": "application/clio",
                "file_extension": ".clio",
            },
            "banner": (
                "Clio Kernel v0.1\n"
            ),
            "help_links": [{
                "text": "Clio Homepage",
                "url": "https://github.com/pouya-eghbali/clio",
            }],
        };
    }

    return config;
}
