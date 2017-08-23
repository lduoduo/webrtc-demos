// SDK专属打包工具

'use strict';
const path = require('path');
const webpack = require('webpack');

//清空build目录
var CleanPlugin = require('clean-webpack-plugin');

const ExtractTextPlugin = require("extract-text-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');

/** 引入工具 */
const tool = require('./utils.js');

/** 监听源文件的根目录 */
const srcPath = path.resolve(__dirname, "src/app");
/** 文件生成后存放的根目录 */
// const distPath = path.resolve(__dirname, "dist");
const distPath = path.resolve(__dirname, "../public/lib");

// 获取本地ip
const ip = tool.getLocalIP()
/** 服务器上的静态资源公开目录 */
const publicPath = `//${ip}:8091/static/lib/`;
/** 生成脚本样式之后的文件存放的路径前缀 */
const preStatic = 'page';

console.info('\n *************************************打包开始************************************ \n');

var config = {
    /**
     * 从context的文件夹里读取entry里面所有的文件进行解析,打包代码里面的依赖(import / require)
     * 将所有东西打包到output.path对应的文件夹里, 使用output.filename对应的命名模板来命名([name]被entry里的对象键值替代)
     */
    // context: srcPath,
    // the environment in which the bundle should run
    // changes chunk loading behavior and available modules
    target: "web",
    entry: {
        // rtcSDK: ["babel-polyfill", "./src/lib/rtcSDK.js"],
        rtcSDK: "./src/sdk/rtcSDK.js",
        webAudio: "./src/sdk/webAudio.js"
    },
    output: {
        path: distPath,
        filename: '[name].js',
        // filename: '[name]-[chunkhash].js',
        publicPath: publicPath,
        /**
         * 这样就会把打包结果绑定到一个 window.myClassName 实例上。所以使用这种命名作用域，就可以调用 entry 点里面的方法了
         * 参考: https://webpack.js.org/concepts/output/#output-library
         */
        // library: 'dodo',
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: [{
                    loader: 'babel-loader',
                    options: { presets: ['es2015'] }
                }]
            },
            { test: /\.ejs$/, use: ['ejs-loader?variable=data'] }
        ]
    },
    resolve: {
        /**
         * 首先指定了我们自己的源文件目录，然后是 node_modules。
         * 这样子 Webpack 解决起来就会处理得更好一些，按照那个顺序先找我们的源文件目录，
         * 然后是已安装的 Node Modules（分别用你自己的源码和 Node Modules 目录替换其中的 src 和 node_modules）。
         */
        modules: [path.resolve(__dirname, "src"), "node_modules"]
    },
    // 问题：https://segmentfault.com/q/1010000004399596
    node: {
        fs: 'empty'
    },
    plugins: [
        new webpack.optimize.OccurrenceOrderPlugin(),
        // https://github.com/mishoo/UglifyJS2/issues/1246#issuecomment-237535244
        // new webpack.optimize.UglifyJsPlugin({
        //     compress: {
        //         warnings: false,
        //         screw_ie8: false,
        //         drop_console: true
        //     },
        //     mangle: {
        //         screw_ie8: false
        //     },
        //     output: {
        //         screw_ie8: false
        //     }
        // }),
        // new webpack.optimize.DedupePlugin(),
    ],
    watch: true
}

module.exports = config;
