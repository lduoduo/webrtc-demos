/** 
 * 日志的跟踪打印，用于没有办法debug的情况
 */
var fs = require('fs');
var path = require("path");

var config = require('../../config');

var rootPath = path.join(__dirname, '../../log/logs.log');

var txt = "";

function Log(data) {
    // if(config.env === "product"){
    //     return;
    // }
    var t = new Date();
    txt += '\n' + t.toLocaleString() + ' ---> ' + JSON.stringify(data);
    fs.writeFile(rootPath, txt, (err) => {
        if(err) console.log(err);
    });
}

//定时清除日志
setInterval(clearLog,600000);

function clearLog(){
    fs.writeFile(rootPath, "", (err) => {
        if(err) console.log(err);
    });
}

module.exports = Log;