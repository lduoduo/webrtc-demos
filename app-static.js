'use strict';
var https = require('https');
var koa = require('koa');
var app = koa();

var fs = require('fs');

var statics = require('koa-static');
var mount = require('koa-mount');
// var serve = require('koa-serve');

var a = koa();
/** Access-Control-Allow-Origin */
var cors = require('koa-cors');

var enforceHttps = require('koa-sslify');

var config = require('./config');
var staticPort = config.staticPort;
var env = config.env;

//https option
var options = {
    key: fs.readFileSync('keys/server.key'),
    cert: fs.readFileSync('keys/server.crt'),
    port: 8091
};

module.exports = function () {

    if (env) {

        app.use(cors());

        // app.use(enforceHttps(options));

        /** static file folder */
        // app.use(serve('/static', __dirname + '/public/app/dest/'));
        // app.use(mount('/static', statics(__dirname + '/public/app/dest/')));
        a.use(statics(__dirname + '/public/'));
        app.use(mount('/static', a));
        // app.use(statics(__dirname + '/public/app/dest/'));

        app.listen(staticPort);

        console.log('static on ' + staticPort);

        if (config.env === 'dev') {
            //https
            https.createServer(options, app.callback()).listen(config.staticPorts, function () {
                console.log('static https on ' + config.staticPorts);
            });
        }

    }

}