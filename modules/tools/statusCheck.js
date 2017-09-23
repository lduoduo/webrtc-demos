/** 
 * 启动服务器时做的一些状态检查
 *
*/
var fs = require('fs');
var path = require("path");
// 日志记录到文件
var logs = require('./log.js')

// 日志路径
var rootPath = path.join(__dirname, '../../log');

module.exports = function * () {
  yield fileFolderCheck;
  yield init;
}

function fileFolderCheck(done) {
  
      console.log('server status check');
      // 判断文件夹是否存在
      fs.stat(rootPath, function (err) {
          if (err) {
              logs('no log folder');
              // 创建文件夹
              fs.mkdir(rootPath, function (err) {
                  logs(err);
                  if(!err){
                      logs('created log folder');
                  }
                  done(null, '');
              });
          } else {
              logs('already has log folder');
              done(null, '');
          }
      });
  
  }

function init (done) {
  logs('server init console.log')
  let log = console.log
  let info = console.info
  let error = console.error
  let warn = console.warn

  global.console.log = function(){
      // arguments 记录
      log.apply(this, [...arguments])
      let args = [...arguments];
      args.map((item) => {
        logs(item)
      })
  }

  console.log('替换 console')
  done(null, '')
}
