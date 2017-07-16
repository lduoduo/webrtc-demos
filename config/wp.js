/** 提供给webpack打包程序使用的环境变量 */
'use strict';

// var env = process.env.NODE_ENV || "dev";
var env = require('./env.js');

var config = require(`./config.${env}.js`);

module.exports = function (env) {
    env = env || require('./env.js');
    var config = require(`./config.${env}.js`);
    return new config();
}