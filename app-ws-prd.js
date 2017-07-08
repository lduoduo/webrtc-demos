// var https = require('http');
// var koa = require('koa');
// var app = koa();
// app.proxy = true;

const url = require('url');
const WebSocket = require('ws');

var config = require('./config');
//临时改一下

//https
// var server = https.createServer(options, app.callback());
// var server = https.createServer(app.callback());
const wss = new WebSocket.Server({ port: config.socketPortWS });

// 心跳逻辑
function heartbeat() {
    this.isAlive = true;
}
const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
        if (ws.isAlive === false) return ws.terminate();

        ws.isAlive = false;
        ws.ping('', false, true);
    });
}, 30000);

// 业务逻辑
var room = {};
var users = {};

// 
/**
 * 消息数据结构约定如下:
 */
sampleData = {
    // 消息类型
    type: {
        'join': '加入',
        'leave': '退出',
        'sys': '系统消息',
        'room': '房间消息',
        'peer': 'webrtc指令消息',
        'self': '发给自己的消息',
        'msg': '自定义发送的文本消息',
        // 'user': '私聊目标账号'
    },
    // 自定义消息体, 任意类型
    data: ['any']
}

wss.on('connection', function connection(ws, req) {
    // 缓存ws.send方法
    let send = ws.send
    // 改写包装
    ws.send = function(type, data) {
        // 如果客户端连接已关闭，不再发送消息
        if (this.readyState !== WebSocket.OPEN) return
        data.code = data.code || 200
        data = {
            type,
            data
        }
        send.call(this, JSON.stringify(data));
    }

    // 当有客户端接入，开启心跳
    ws.isAlive = true;
    ws.on('pong', heartbeat);

    var roomId;
    var user = {};

    // dev
    // const ip = req.connection.remoteAddress;
    // prod
    // const ip = req.headers['x-forwarded-for'];
    // console.log(req.headers)
    console.log(`ip : ${req.headers['x-forwarded-for']}`)


    const location = url.parse(req.url, true);
    // You might use location.query.access_token to authenticate or share sessions
    // or req.headers.cookie (see http://stackoverflow.com/a/16395220/151312)

    roomId = location.query && location.query.roomId || 'my'
    if (!room[roomId]) {
        room[roomId] = {};
    }
    var tmp = room[roomId];

    // 消息处理
    ws.on('message', function incoming(message) {
        // console.log('received: %s', message);

        // 先解码
        message = JSON.parse(message || null)
        let {type, data} = message

        if (type) {
            option[type] && option[type](data)
        }

    });

    ws.send('self', 'ready to join');

    var option = {
        sys() {

        },
        // 加入房间
        join(userinfo) {
            console.log(`sb going to join-->`, roomId, Object.keys(tmp));
            if (Object.keys(tmp).length >= 2) {
                //通知要连接的客户，当前房间已经满员，不能加入
                ws.send('self', { type: 'join', code: 500, error: "房间已满, 请另选房间重新加入" });
                console.log(`房间：${roomId}已满，请另选房间重新加入`)
                return;
            }
            if (userinfo && userinfo.id && userinfo.name) {
                user = userinfo;
                tmp[user.id] = user;
                tmp[user.id].ws = ws;
                users[user.id] = tmp[user.id]
                // return;
            } else {
                var id = "000" + Math.floor(Math.random() * 1000);
                id = id.slice(-5); id = id.replace('0', 'a');
                user.id = id;
                user.name = id;
                // user.name = (userinfo && userinfo.name) || user.id;
                tmp[user.id] = user;
                tmp[user.id].ws = ws;
                users[user.id] = tmp[user.id]
                users[user.id].roomId = roomId
            }

            //给自己发消息
            ws.send('self', {
                type: 'join', 
                code: 200,
                user: {
                    id: user.id, name: user.name
                }
            });

            // 广播向其他用户发消息
            wss.to(roomId, ws).send('sys', {
                code: 200,
                type: 'in',
                data: {
                    id: user.id, name: user.name
                }
            });

            // console.log(user.id + '加入了' + roomId);
            console.log(`${user.id} join-->`, roomId, Object.keys(tmp));
        },
        // rtc指令消息
        peer(data) {
            // 广播向其他用户发消息
            wss.to(roomId, ws).send('peer', data);
        },
        // 离开房间
        leave(userinfo = {}) {
            let userid = userinfo.id
            if (userid && users[userid].roomId) {
                // 广播向其他用户发消息
                wss.to(roomId, ws).send('sys', {
                    code: 200,
                    type: 'out',
                    data: {
                        id: userid, name: userinfo.name
                    }
                });
                delete users[userid]
                delete room[roomId][userid]

                console.log(`${userid} leave-->`, roomId, Object.keys(tmp));
                if (Object.keys(tmp).length === 0) {
                    delete room[roomId]
                }
                // 移除client
                wss.remove(ws)
            }
        }
    }
});

/**
 * 发送消息
 * 参数: channelId, 频道号或者是userId, 不填写的话默认广播给所有人
 * 可选参数: ws, 不会给该客户端发送消息(一般来说房间里的消息不会发送给自己)
 * 调用方式: wss.to(channelId).send()
 */
wss.to = function to(channelId, ws) {
    let clients = this.sendingList = []
    if (!channelId) return this

    // 先查找是否是房间号, 发给房间里所有人
    if (channelId && channelId in room) {
        let tmp = room[channelId]
        for (let i in tmp) {
            tmp[i] && tmp[i].ws && (!ws || tmp[i].ws !== ws) && clients.push(tmp[i].ws)
        }
        return this
    }
    // 是否发给某人
    if (channelId && channelId in users) {
        users[channelId] && users[channelId].ws && (!ws || tusers[channelId].ws !== ws) && clients.push(users[channelId].ws)
        return this
    }
}
/**
 * 广播消息
 * 参数: 要排除的ws, 如果不传，则广播给所有的客户端
 * 调用方式: wss.broadcast().send()
 */
wss.broadcast = function broadcast(ws) {
    let that = this

    that.sendingList = []

    if (!ws) {
        that.sendingList = that.clients;
        return that;
    }

    that.sendingList = that.clients.filter(function each(client) {
        return client !== ws
    });

    return that
};
/**
 * 实际发送消息
 * 如果单独访问这个方法，则视为广播给所有人的消息
 * data: 发送的消息体
 */
wss.send = function(type, data) {
    if (!data) return
    if (!this.sendingList) return send(this.clients)

    send(this.sendingList)

    function send(list) {
        list.forEach(client => {
            client.send(type, data)
        })
    }
}
/**
 * 移除连接实体ws
 */
wss.remove = function(ws) {
    if (!ws) return
    // 这里的clients数据结构是set，删除相对简单
    this.clients.delete(ws)
}

module.exports = function() {
    
    console.log('ws server http on ' + config.socketPortWS + ' env: ' + config.env);

}

