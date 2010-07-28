/*
  node-http-proxy.js: http proxy for node.js

  Copyright (c) 2010 Charlie Robbins & Marak Squires http://github.com/nodejitsu/node-http-proxy

  Permission is hereby granted, free of charge, to any person obtaining
  a copy of this software and associated documentation files (the
  "Software"), to deal in the Software without restriction, including
  without limitation the rights to use, copy, modify, merge, publish,
  distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so, subject to
  the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
  LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
  WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/
 
var vows = require('vows'),
    sys = require('sys'),
    assert = require('assert'),
    http = require('http');

require.paths.unshift(require('path').join(__dirname, '../lib/'));

var httpProxy = require('node-http-proxy').httpProxy;
var testServers = {};

//
// Simple 'hello world' response for test purposes
//
var helloWorld = function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write('hello world')
	res.end();
};

//
// Creates the reverse proxy server
//
var startProxyServer = function (server, port, proxy) {
  var proxyServer = http.createServer(function (req, res){
    // Initialize the nodeProxy and start proxying the request
    proxy.init(req, res);
    proxy.proxyRequest(server, port, req, res);
  });
  
  proxyServer.listen(8080);
  return proxyServer;
};

// 
// Creates the reverse proxy server with a specified latency
//
var startLatentProxyServer = function (server, port, proxy, latency) {
  var proxyServer = http.createServer(function (req, res){
    // Initialize the nodeProxy and start proxying the request
    proxy.init(req, res);
    setTimeout(function () {
      proxy.proxyRequest(server, port, req, res);
    }, latency);
  });
  
  proxyServer.listen(8081);
  return proxyServer;
};

//
// Creates the 'hellonode' server
//
var startTargetServer = function (port) {
  var targetServer = http.createServer(function (req, res) {
    helloWorld(req, res);
  })
  
  targetServer.listen(port);
  return targetServer;
};

//
// The default test bootstrapper with no latency
//
var startTest = function (proxy, port) {
  testServers.noLatency = [];
  testServers.noLatency.push(startProxyServer('127.0.0.1', port, proxy));
  testServers.noLatency.push(startTargetServer(port));
};

//
// The test bootstrapper with some latency
//
var startTestWithLatency = function (proxy, port) {
  testServers.latency = [];
  testServers.latency.push(startLatentProxyServer('127.0.0.1', port, proxy, 2000));
  testServers.latency.push(startTargetServer(port));
};

vows.describe('node-proxy').addBatch({
  "When an incoming request is proxied to the helloNode server" : {
    "with no latency" : {
      topic: function () {
        var proxy = new httpProxy;
        startTest(proxy, 8082);
        proxy.emitter.addListener('end', this.callback);

        var client = http.createClient(8080, '127.0.0.1');
        var request = client.request('GET', '/');
        request.end();
      },
      "it should received 'hello world'": function (err, body) {
        assert.equal(body, 'hello world');
        testServers.noLatency.forEach(function (server) {
          server.close();
        })
      }
    },
    "with latency": {
      topic: function () {
        var proxy = new httpProxy;
        startTestWithLatency(proxy, 8083);
        proxy.emitter.addListener('end', this.callback);

        var client = http.createClient(8081, '127.0.0.1');
        var request = client.request('GET', '/');
        request.end();
      },
      "it should receive 'hello world'": function (err, body) {
        assert.equal(body, 'hello world');
        testServers.latency.forEach(function (server) {
          server.close();
        })
      }
    }
  }
}).export(module);