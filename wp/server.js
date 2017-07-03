//开发环境的服务器
'use strict';

const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
var config = require('./wp.dev');

const serverPort = 9009,
	devPort = 9001;

config.entry['webpack-dev-server'] = 'webpack-dev-server/client?http://localhost:' + devPort;
// const compiler = webpack(config);

//启动服务
var app = new WebpackDevServer(webpack(config), {
	contentBase: [path.resolve(__dirname, 'src')],
	publicPath: '/static/',
	hot: true,
	compress: true,
	clientLogLevel: "info",
	headers: {
		"X-Custom-Foo": "webpack demo"
	},
	watchOptions: {
		aggregateTimeout: 1000, // in ms
		poll: 1000
		// aggregates multiple changes to a single rebuild
	},
	stats: { colors: true }
});

// app.listen(devPort, "10.101.40.14", function () {
// 	console.log('dev server on port:' + devPort + '\n');
// });

app.listen(devPort, function () {
	console.log('dev server on port:' + devPort + '\n');
});