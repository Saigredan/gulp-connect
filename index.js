// Generated by CoffeeScript 1.12.7
var ConnectApp, apps, colors, connect, es, fancyLog, fs, http, https, liveReload, path, send, serveIndex, serveStatic, tiny_lr;

path = require("path");

fancyLog = require("fancy-log");

colors = require("ansi-colors");

es = require("event-stream");

http = require("http");

https = require("https");

fs = require("fs");

connect = require("connect");

serveStatic = require('serve-static');

serveIndex = require('serve-index');

liveReload = require("connect-livereload");

send = require("send");

tiny_lr = require("tiny-lr");

apps = [];

ConnectApp = (function() {
  function ConnectApp(options, startedCallback) {
    this.name = options.name || "Server";
    this.port = options.port || "8080";
    this.root = options.root || path.dirname(module.parent.id);
    this.host = options.host || "localhost";
    this.debug = options.debug || false;
    this.silent = options.silent || false;
    this.https = options.https || false;
    this.preferHttp1 = options.preferHttp1 || false;
    this.livereload = options.livereload || false;
    this.middleware = options.middleware || void 0;
    this.startedCallback = startedCallback || function() {
      return {};
    };
    this.serverInit = options.serverInit || void 0;
    this.fallback = options.fallback || void 0;
    this.index = options.index;
    if (options.open) {
      this.oldMethod("open");
    }
    this.sockets = [];
    this.app = void 0;
    this.lr = void 0;
    this.state = "initializing";
    this.run();
  }

  ConnectApp.prototype.run = function() {
    var http2;
    if (this.state === "stopped") {
      return;
    }
    this.state = "starting";
    this.log("Starting server...");
    this.app = connect();
    this.handlers().forEach((function(_this) {
      return function(middleware) {
        if (typeof middleware === "object") {
          return _this.app.use(middleware[0], middleware[1]);
        } else {
          return _this.app.use(middleware);
        }
      };
    })(this));
    this.app.use(serveIndex(typeof this.root === "object" ? this.root[0] : this.root));
    if (this.https) {
      if (typeof this.https === 'boolean' || !this.https.key) {
        if (!(typeof this.https === "object")) {
          this.https = {};
        }
        this.https.key = fs.readFileSync(__dirname + '/certs/server.key');
        this.https.cert = fs.readFileSync(__dirname + '/certs/server.crt');
        this.https.ca = fs.readFileSync(__dirname + '/certs/server.crt');
        this.https.passphrase = 'gulp';
      }
      http2 = void 0;
      if (!this.preferHttp1) {
        try {
          http2 = require('http2');
        } catch (error) {}
      }
      if (http2) {
        this.https.allowHTTP1 = true;
        this.server = http2.createSecureServer(this.https, this.app);
      } else {
        this.server = https.createServer(this.https, this.app);
      }
    } else {
      this.server = http.createServer(this.app);
    }
    if (this.serverInit) {
      this.serverInit(this.server);
    }
    return this.server.listen(this.port, this.host, (function(_this) {
      return function(err) {
        var sockets, stopServer, stoped;
        if (err) {
          return _this.log("Error on starting server: " + err);
        } else {
          _this.log(_this.name + " started http" + (_this.https ? 's' : '') + "://" + _this.host + ":" + _this.port);
          stoped = false;
          sockets = [];
          _this.server.on("close", function() {
            if (!stoped) {
              stoped = true;
              return _this.log(_this.name + " stopped");
            }
          });
          _this.server.on("connection", function(socket) {
            _this.logDebug("Received incoming connection from " + (socket.address().address));
            _this.sockets.push(socket);
            return socket.on("close", function() {
              return _this.sockets.splice(_this.sockets.indexOf(socket), 1);
            });
          });
          _this.server.on("request", function(request, response) {
            return _this.logDebug("Received request " + request.method + " " + request.url);
          });
          _this.server.on("error", function(err) {
            return _this.log(err.toString());
          });
          stopServer = function() {
            if (!stoped) {
              _this.sockets.forEach(function(socket) {
                return socket.destroy();
              });
              _this.server.close();
              if (_this.livereload) {
                _this.lr.close();
              }
              return process.nextTick(function() {
                return process.exit(0);
              });
            }
          };
          process.on("SIGINT", stopServer);
          process.on("exit", stopServer);
          if (_this.livereload) {
            tiny_lr.Server.prototype.error = function() {};
            if (_this.https) {
              _this.lr = tiny_lr({
                key: _this.https.key || fs.readFileSync(__dirname + '/certs/server.key'),
                cert: _this.https.cert || fs.readFileSync(__dirname + '/certs/server.crt')
              });
            } else {
              _this.lr = tiny_lr();
            }
            _this.lr.listen(_this.livereload.port);
            _this.log("LiveReload started on port " + _this.livereload.port);
          }
          _this.state = "running";
          _this.log("Running server");
          return _this.startedCallback();
        }
      };
    })(this));
  };

  ConnectApp.prototype.close = function() {
    if (this.state === "running") {
      this.log("Stopping server");
      if (this.livereload) {
        this.lr.close();
      }
      this.server.close();
      this.state = "stopped";
      return this.log("Stopped server");
    } else if (this.state === "stopped") {
      return this.log("Server has already been stopped.");
    } else {
      return this.log("Ignoring stop as server is in " + this.state + " state.");
    }
  };

  ConnectApp.prototype.handlers = function() {
    var steps;
    steps = this.middleware ? this.middleware.call(this, connect, this) : [];
    if (this.livereload) {
      if (typeof this.livereload === "boolean") {
        this.livereload = {};
      }
      if (!this.livereload.port) {
        this.livereload.port = 35729;
      }
      steps.unshift(liveReload(this.livereload));
    }
    if (this.index === true) {
      this.index = "index.html";
    }
    if (typeof this.root === "object") {
      this.root.forEach(function(path) {
        return steps.push(serveStatic(path, {
          index: this.index
        }));
      });
    } else {
      steps.push(serveStatic(this.root, {
        index: this.index
      }));
    }
    if (this.fallback) {
      steps.push((function(_this) {
        return function(req, res) {
          var fallbackPath;
          fallbackPath = _this.fallback;
          if (typeof _this.fallback === "function") {
            fallbackPath = _this.fallback(req, res);
          }
          return send(req, fallbackPath).pipe(res);
        };
      })(this));
    }
    return steps;
  };

  ConnectApp.prototype.log = function(text) {
    if (!this.silent) {
      return fancyLog(colors.green(text));
    }
  };

  ConnectApp.prototype.logWarning = function(text) {
    if (!this.silent) {
      return fancyLog(colors.yellow(text));
    }
  };

  ConnectApp.prototype.logDebug = function(text) {
    if (this.debug) {
      return fancyLog(colors.blue(text));
    }
  };

  ConnectApp.prototype.oldMethod = function(type) {
    var text;
    text = 'does not work in gulp-connect v 2.*. Please read "readme" https://github.com/AveVlad/gulp-connect';
    switch (type) {
      case "open":
        return this.logWarning("Option open " + text);
    }
  };

  return ConnectApp;

})();

module.exports = {
  server: function(options, startedCallback) {
    var app;
    if (options == null) {
      options = {};
    }
    if (startedCallback == null) {
      startedCallback = null;
    }
    app = new ConnectApp(options, startedCallback);
    apps.push(app);
    return app;
  },
  reload: function() {
    return es.map(function(file, callback) {
      apps.forEach((function(_this) {
        return function(app) {
          if (app.livereload && typeof app.lr === "object") {
            return app.lr.changed({
              body: {
                files: file.path
              }
            });
          }
        };
      })(this));
      return callback(null, file);
    });
  },
  serverClose: function() {
    apps.forEach(function(app) {
      return app.close();
    });
    return apps = [];
  }
};
