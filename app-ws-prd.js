const url = require('url');
const WebSocket = require('ws');

var config = require('./config');
//临时改一下

const wss = new WebSocket.Server({ port: config.socketPortWS });

// 心跳逻辑
function heartbeat() {
  this.isAlive = true;
}

const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    // console.log(`ws id: ${ws._ultron.id} status: ${ws.isAlive} readyState: ${ws.readyState}`);
    
    if (ws.isAlive === false) {
        delete room[ws.roomId][ws.userId];
        console.log(`ws 销毁: ${ws.userId} leave ---> ${ws.roomId} [${Object.keys(room[ws.roomId])}]`);
        ws.terminate();
        return;
    }

    ws.isAlive = false;
    ws.ping('', false, true);
  });
}, 2000);

// 业务逻辑
var room = {};
var users = {};

/**
 * 消息数据结构约定如下:
 */
sampleData = {
  // 消息类型
  type: {
    join: '加入',
    leave: '退出',
    sys: '系统消息',
    room: '房间消息',
    peer: 'webrtc指令消息',
    self: '发给自己的消息',
    msg: '自定义发送的文本消息'
    // 'user': '私聊目标账号'
  },
  // 自定义消息体, 任意类型
  data: ['any']
};

wss.on('connection', function connection(ws, req) {
  // 缓存ws.send方法
  let send = ws.send;
  // 改写包装
  ws.send = function(type, data) {
    // 如果客户端连接已关闭，不再发送消息
    if (this.readyState !== WebSocket.OPEN) return;
    data.code = data.code || 200;
    data = {
      type,
      data
    };
    send.call(this, JSON.stringify(data));
  };

  // 当有客户端接入，开启心跳
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  // 客户端加入的房号
  var clientRoomId;
  var user = {};

  // dev
  // const ip = req.connection.remoteAddress;
  // prod
  const ip = req.headers['x-forwarded-for'];
  // console.log(req.headers)
  console.log(`ip : ${req.headers['x-forwarded-for']}`);

  const location = url.parse(req.url, true);
  // You might use location.query.access_token to authenticate or share sessions
  // or req.headers.cookie (see http://stackoverflow.com/a/16395220/151312)

  // 消息处理
  ws.on('message', function incoming(message) {
    // console.log('received: %s', message);

    // 先解码
    message = JSON.parse(message || null);
    let { type, data } = message;

    if (type) {
      option[type] && option[type](data);
    }
  });

  ws.send('self', 'ready to join');

  var option = {
    sys() {},
    // 加入房间
    join(data = {}) {
      let { userId, userName, roomId } = data;

      // 先检查有无房间号
      if (!roomId)
        return ws.send('self', { type: 'join', code: 500, error: '房间号码缺失' });

      clientRoomId = roomId;

      // 如果房间不存在，新建房间
      if (!room[roomId]) {
        room[roomId] = {};
      }
      let tmp = room[roomId];

      console.log(`${ip} going to join--> ${roomId} [${Object.keys(tmp)}]`);
      if (Object.keys(tmp).length >= 2) {
        //通知要连接的客户，当前房间已经满员，不能加入
        ws.send('self', { type: 'join', code: 500, error: '房间已满, 请另选房间重新加入' });
        console.log(`房间：${roomId}已满`);
        return;
      }
      if (userId && userName) {
        user = { userId, userName };
        tmp[userId] = user;
        tmp[userId].ws = ws;
        users[userId] = tmp[userId];
        // return;
      } else {
        var id = wss.randomUserId();

        userId = user.userId = id;
        userName = user.userName = id;
        // user.name = (userinfo && userinfo.name) || user.id;
        tmp[userId] = user;
        tmp[userId].ws = ws;
        users[userId] = tmp[userId];
        users[userId].roomId = roomId;
      }

      // 给ws实例挂载userid和roomid
      ws.roomId = roomId;
      ws.userId = userId;

      //给自己发消息
      ws.send('self', {
        type: 'join',
        code: 200,
        user: {
          userId,
          userName
        }
      });

      // 广播向其他用户发消息
      wss.to(roomId, ws).send('sys', {
        code: 200,
        type: 'in',
        data: {
          userId,
          userName
        }
      });

      console.log(`${userId} join--> ${roomId} [${Object.keys(tmp)}]`);
    },
    // rtc指令消息
    peer(data) {
      // 广播向其他用户发消息
      wss.to(clientRoomId, ws).send('peer', data);
    },
    // 离开房间
    leave(userinfo = {}) {
      let { userId, userName } = userinfo;

      if (userId && users[userId].roomId) {
        roomId = users[userId].roomId;

        // 广播向其他用户发消息
        wss.to(roomId, ws).send('sys', {
          code: 200,
          type: 'out',
          data: {
            userId,
            userName
          }
        });
        delete users[userId];
        delete room[roomId][userId];

        let myRoom = Object.keys(room[roomId]);

        console.log(`${userId} leave--> ${roomId}`, myRoom);
        if (myRoom.length === 0) {
          delete room[roomId];
        }
        // 移除client
        wss.remove(ws);
      }
    }
  };
});

/**
 * 发送消息
 * 参数: channelId, 频道号或者是userId, 不填写的话默认广播给所有人
 * 可选参数: ws, 不会给该客户端发送消息(一般来说房间里的消息不会发送给自己)
 * 调用方式: wss.to(channelId).send()
 */
wss.to = function to(channelId, ws) {
  let clients = (this.sendingList = []);
  if (!channelId) return this;

  // 先查找是否是房间号, 发给房间里所有人
  if (channelId && channelId in room) {
    let tmp = room[channelId];
    for (let i in tmp) {
      tmp[i] &&
        tmp[i].ws &&
        (!ws || tmp[i].ws !== ws) &&
        clients.push(tmp[i].ws);
    }
    return this;
  }
  // 是否发给某人
  if (channelId && channelId in users) {
    users[channelId] &&
      users[channelId].ws &&
      (!ws || tusers[channelId].ws !== ws) &&
      clients.push(users[channelId].ws);
    return this;
  }
};
/**
 * 广播消息
 * 参数: 要排除的ws, 如果不传，则广播给所有的客户端
 * 调用方式: wss.broadcast().send()
 */
wss.broadcast = function broadcast(ws) {
  let that = this;

  that.sendingList = [];

  if (!ws) {
    that.sendingList = that.clients;
    return that;
  }

  that.sendingList = that.clients.filter(function each(client) {
    return client !== ws;
  });

  return that;
};
/**
 * 实际发送消息
 * 如果单独访问这个方法，则视为广播给所有人的消息
 * data: 发送的消息体
 */
wss.send = function(type, data) {
  if (!data) return;
  if (!this.sendingList) return send(this.clients);

  send(this.sendingList);

  function send(list) {
    list.forEach(client => {
      client.send(type, data);
    });
  }
};
/**
 * 移除连接实体ws
 */
wss.remove = function(ws) {
  if (!ws) return;
  // 这里的clients数据结构是set，删除相对简单
  this.clients.delete(ws);
};
/**
 * 获取用户id随机数 0 - 10000
 */
wss.randomUserId = function() {
  var id = '0000' + Math.floor(Math.random() * 10000);
  id = id.slice(-5);
  id = id.replace('0', 'a');
  if (!users[id]) {
    return id;
  }
  return this.randomUserId();
};

module.exports = function() {
  console.log(
    'ws server http on ' + config.socketPortWS + ' env: ' + config.env
  );
};
