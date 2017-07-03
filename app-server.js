'use strict';

var koa = require('koa');
var app = koa();
app.proxy = true;

var http = require('http');
var https = require('https');

var fs = require('fs');

var co = require('co');
var session = require('koa-session');
var compose = require('koa-compose');
var body = require('koa-body');

// var enforceHttps = require('koa-sslify');

var config = require('./config');
var modules = require('./modules');
var routers = require('./routers');
var service = require('./service');

//session config
var CONFIG = {
	key: 'koa:sess', /** (string) cookie key (default is koa:sess) */
	maxAge: 86400000, /** (number) maxAge in ms (default is 1 days) */
	overwrite: true, /** (boolean) can overwrite or not (default true) */
	httpOnly: true, /** (boolean) httpOnly or not (default true) */
	signed: true, /** (boolean) signed or not (default true) */
};

//https option
var options = {
	key: fs.readFileSync('keys/server.key'),
	cert: fs.readFileSync('keys/server.crt'),
	port: 8081
};

module.exports = function () {
	Promise.all([

		co(start)

	]).catch(function (e) {

		console.log('err:' + e.stack);

	});
};

function* start() {
	var ver = require('./package.json').version;

	var mw = compose([
		/** force to redirect to https on all pages */
		// enforceHttps(options),
		/** control internal error */
		service['500'],
		/** send response time to browser */
		modules.timer(),
		/** send version of server to browser */
		modules.version(ver),
		/** init session storage */
		session(CONFIG, app),
		/** init local route */
		routers.start(),
		/** handle all 404 errors */
		service['404']
	]);

	app.use(body());
	app.use(modules.urlFilter(mw));

	// app.use(service['404']);

	// app.listen(config.serverPort);

	//http server
	http.createServer(app.callback()).listen(config.serverPort, function () {
		console.log('server http on ' + config.serverPort);
	});

	//https
	https.createServer(options, app.callback()).listen(config.serverPorts, function () {
		console.log('server https on ' + config.serverPorts);
	});

	app.on('error', function (err, ctx) {
		console.log('err:' + err.stack);
	});

	// console.log('server on ' + config.serverPort);

}