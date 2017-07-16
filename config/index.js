/** 提供给应用程序使用的环境变量 */
'use strict';

// var env = process.env.NODE_ENV || "dev";
var env = require('./env.js');

var config = require(`./config.${env}.js`);

module.exports = new config();