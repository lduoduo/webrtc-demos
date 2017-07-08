'use strict';
var env = require('./config/env.js');

console.log('env:' + env);
/** start main server */
var server = require('./app-server')();
/** start static server(send staic files such as js/css/jpg/png) */
var statics = require('./app-static')();
/** start socket server */
var io = require(`./app-io-${env}`)();
var ws = require(`./app-ws-${env}`)();