/** 
 * 启动服务器时做的一些状态检查
 *
*/
// 日志记录到文件
var logs = require('./log.js')

module.exports = function * () {
  yield init
}

function init (done) {
  logs('server init console.log')
  let log = console.log
  let info = console.info
  let error = console.error
  let warn = console.warn

  global.console.log = function(){
      // arguments 记录
      log.call(this, arguments)
      let args = [...arguments];
      args.map((item) => {
        logs(item)
      })
  }

  console.log('替换 console')
  done(null, '')
}
