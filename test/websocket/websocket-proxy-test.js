/*
  node-http-proxy-test.js: http proxy for node.js

  Copyright (c) 2010 Charlie Robbins, Marak Squires and Fedor Indutny

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

var util = require('util'),
    assert = require('assert'),
    argv = require('optimist').argv,
    colors = require('colors'),
    request = require('request'),
    vows = require('vows'),
    helpers = require('../helpers');

var options = helpers.parseProtocol(),
    testName = [options.source.protocols.ws, options.target.protocols.ws].join('-to-'),
    runner = new helpers.TestRunner(options);

vows.describe('node-http-proxy/http-proxy/' + testName).addBatch({
  "When using server created by httpProxy.createServer()": {
    "with no latency" : {
      "when an inbound message is sent from a WebSocket client": {
        topic: function () {
          var that = this,
              headers = {};

          runner.webSocketTest({
            host: 'localhost',
            wsprotocol: options.source.protocols.ws,
            protocol: options.source.protocols.http,
            ports: {
              target: 8130,
              proxy: 8131
            },
            onListen: function (socket) {
              socket.on('connection', function (client) {
                headers.request = client.upgradeReq.headers;
                client.on('message', function (msg) {
                  that.callback(null, msg, headers);
                });
              });
            },
            onOpen: function (ws) {
              ws.send('from client');
            },
            onServer: function (server) {
              server.proxy.on('websocket:incoming',function(proxy){
                headers.response = proxy.res.headers;
              });
            }
          });
        },
        "the target server should receive the message": function (err, msg, headers) {
          assert.isNull(err);
          assert.equal(msg, 'from client');
        },
        "the headers for request should be valid": function (err, msg, headers) {
          assert.isNull(err);
          assert.isString(headers.request.connection);
          assert.isString(headers.request.upgrade);
          assert.equal('Upgrade', headers.request.connection);
          assert.equal('websocket', headers.request.upgrade);
        },
        "the headers for response should be valid": function (err, msg, headers) {
          assert.isNull(err);
          assert.isString(headers.response.connection);
          assert.isString(headers.response.upgrade);
          assert.equal('Upgrade', headers.response.connection);
          assert.equal('websocket', headers.response.upgrade);
        },
        "the response should have the 'sec-websocket-accept' header": function (err, msg, headers) {
          assert.isNull(err);
          assert.isString(headers.response['sec-websocket-accept']);
        }
      },
      "when an inbound message is sent from a WebSocket client with event listeners": {
        topic: function () {
          var that = this;

          runner.webSocketTest({
            host: 'localhost',
            wsprotocol: options.source.protocols.ws,
            protocol: options.source.protocols.http,
            ports: {
              target: 8132,
              proxy: 8133
            },
            onServer: function (server) {
              server.proxy.on('websocket:incoming', function (req, socket, head, data) {
                that.callback(null, data);
              });
            },
            onOpen: function (ws) {
              ws.send('from client');
            }
          });
        },
        "should raise the `websocket:incoming` event": function (ign, data) {
          assert.equal(data.toString().replace('\u0000', ''), 'from client');
        },
      },
      "when an outbound message is sent from the target server": {
        topic: function () {
          var that = this,
              headers = {};

          runner.webSocketTest({
            host: 'localhost',
            wsprotocol: options.source.protocols.ws,
            protocol: options.source.protocols.http,
            ports: {
              target: 8134,
              proxy: 8135
            },
            onListen: function (socket) {
              socket.on('connection', function (client) {
                headers.request = client.upgradeReq.headers;
                client.send('from server');
              });
            },
            onMessage: function (msg) {
              if (!/\d+/.test(msg)) {
                that.callback(null, msg, headers);
              }
            }
          });
        },
        "the client should receive the message": function (err, msg, headers) {
          assert.equal(msg, 'from server');
        },
        "the origin and sec-websocket-origin headers should match": function (err, msg, headers) {
          assert.isString(headers.response['sec-websocket-location']);
          assert.isTrue(headers.response['sec-websocket-location'].indexOf(options.source.protocols.ws) !== -1);
          assert.equal(headers.request.Origin, headers.response['sec-websocket-origin']);
        }
      }/**,
      "when an inbound message is sent from a Socket.io client": {
        topic: function () {
          var that = this
              headers = {};

          runner.webSocketIOTest({
            host: 'localhost',
            wsprotocol: options.source.protocols.ws,
            protocol: options.source.protocols.http,
            ports: {
              target: 8136,
              proxy: 8137
            },
            onListen: function (socket) {
              debugger;
              socket.on('connection', function (client) {
                debugger;
                client.on('message', function (msg) {
                  debugger;
                  that.callback(null, msg, headers);
                });
              });
            },
            onWsupgrade: function (req, res) {
              headers.request = req;
              headers.response = res.headers;
            },
            onOpen: function (ws) {
              ws.send('from client');
            }
          });
        },
        "the target server should receive the message": function (err, msg, headers) {
          assert.equal(msg, 'from client');
        },
        "the origin and sec-websocket-origin headers should match": function (err, msg, headers) {
          assert.isString(headers.response['sec-websocket-location']);
          assert.isTrue(headers.response['sec-websocket-location'].indexOf(options.source.protocols.ws) !== -1);
          assert.equal(headers.request.Origin, headers.response['sec-websocket-origin']);
        }
      }**/
    }
  }
}).addBatch({
  "When the tests are over": {
    topic: function () {
      return runner.closeServers();
    },
    "the servers should clean up": function () {
      assert.isTrue(true);
    }
  }
}).export(module);
