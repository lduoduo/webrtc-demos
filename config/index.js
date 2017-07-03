'use strict';

// var env = process.env.NODE_ENV || "dev";
var env = require('./env.js');

var config = require(`./config.${env}.js`);

module.exports = new config();