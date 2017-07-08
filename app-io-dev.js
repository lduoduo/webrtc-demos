var https = require('https');
var koa = require('koa');
var app = koa();
var socket = require('socket.io');

var fs = require('fs');
var config = require('./config');

//https option
var options = {
    key: fs.readFileSync('keys/server.key'),
    cert: fs.readFileSync('keys/server.crt'),
};
//https
var server = https.createServer(options, app.callback());
// var server = https.createServer(app.callback());
app.on('error', function (err, ctx) {
    console.log('err:' + err.stack);
});

var io = socket(server, { path: '/rtcSocket' });

var room = {};

io.on('connection', function (sockets) {

    var roomId;
    var user = {};
    var querys = sockets.request._query;
    if (sockets.request._query) {
        roomId = querys.roomId || querys.roomid;
    }

    roomId = roomId || "my";

    if (!room[roomId]) {
        room[roomId] = {};
    }
    var tmp = room[roomId];

    sockets.on('join', function (userinfo) {


        if (Object.keys(tmp).length >= 2) {
            //通知要连接的客户，当前房间已经满员，不能加入
            sockets.emit('self', 'error', "当前房间已满，无法加入");
            return;
        }
        if (userinfo && userinfo.id && userinfo.name) {
            user = userinfo;
            tmp[user.id] = user;
            // return;
        } else {
            var id = "000" + Math.floor(Math.random() * 1000);
            id = id.slice(-5); id = id.replace('0', 'a');
            user.id = id;
            user.name = id;
            // user.name = (userinfo && userinfo.name) || user.id;
            tmp[user.id] = user;
        }

        //给自己发消息
        sockets.emit('self', 'self', user);
        // 广播向其他用户发消息
        // sockets.broadcast.emit('sys', 'in', user);
        sockets.to(roomId).emit('sys', 'in', user);

        console.log(user.id + '加入了' + roomId);
        console.log(room[roomId]);

        sockets.join(roomId);

    });
    sockets.on('disconnect', function () {
        // 从房间名单中移除
        if (user && tmp[user.id]) {
            delete tmp[user.id];
            io.to(roomId).emit('sys', 'out', user);
            console.log(user.id + '退出了' + roomId);
            console.log(room);
        }

        if (!room[roomId] || Object.keys(room[roomId]).length == 0) {
            delete room[roomId];
        }

        sockets.leave(roomId);    // 退出房间

    });

    // sockets.on('candidate',function(data){
    //     console.log(data);
    //     sockets.broadcast.emit('candidate', data);
    // });
    // sockets.on('offer',function(data){
    //     console.log(data);
    //     sockets.broadcast.emit('offer', data);
    // });
    // sockets.on('answer',function(data){
    //     console.log(data);
    //     sockets.broadcast.emit('answer', data);
    // });

    /** peer管道信息传递 */
    sockets.on('peer', function (data) {
        // console.log(data);
        //接收客户端的状态信息，判断是否做好连接准备
        if (data.type == "ready") {
            //如果有2个人了，就发出连接命令
            if (Object.keys(tmp).length == 2) {
                sockets.to(roomId).emit('peer', {
                    type: 'peerStart',
                    user: user
                });
                console.log('可以开启p2p连接了');
            }
            return;
        }
        sockets.to(roomId).emit('peer', data);
        // sockets.broadcast.emit('peer', data);
    });

    // 接收用户消息,发送相应的房间
    sockets.on('message', function (users, msg) {
        // 验证如果用户不在房间内则不给发送
        if (!users || !users.id || !tmp[users.id]) {
            return false;
        }

        //向房间发消息
        sockets.to(roomId).emit('msg', users, msg);

        // 广播向所有其他用户发消息
        // sockets.broadcast.emit('msg', users, msg);

        //回复自己
        sockets.emit('msg', users, msg);

    });
});

//临时改一下

module.exports = function () {
    // app.listen(config.socketPortIO);

    server.listen(config.socketPortIO, function () {
        console.log('io server https on ' + config.socketPortIO + ' env: ' + config.env);
    });

    // console.log('socket http on ' + config.socketPortIO);
}

