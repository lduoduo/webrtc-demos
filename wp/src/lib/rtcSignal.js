// rtcSDK 信令服务协议

module.exports = {
    ws: null,
    roomId: null,
    inited: false,
    // 回调监听
    listeners: {},

    /**
     * 加入房间，由于目前参数是带在url上的，这边要处理一下
     * @param {any} roomId // 房间号
     * @param {any} roomId // 房间号
     * @param {any} url // 信令地址
     * @returns
     */
    init(option = {}) {
        let {roomId, url} = option
        if (roomId == this.roomId) {
            return this.emit('connected', {
                status: false,
                error: '请不要反复加入同一个房间，换个房间吧！'
            })
        }

        this.roomId = roomId

        // 换房间登录
        if (this.inited) {
            return this.join();
        }

        // 初次连接登录
        if (!this.inited && url) {
            this.url = url
            this.initSignal()
        }

    },
    // 注册监听回调事件
    on(name, fn) {
        this.listeners[name] = fn
    },
    // 执行回调
    emit(name, data) {
        this.listeners[name] && this.listeners[name](data)
    },
    initSignal() {
        let that = this;
        // this.ws = address;
        var ws = this.ws = new WebSocket(this.url);

        ws.onopen = function () {
            that.inited = true
            that.join();
            console.log("websocket connected");
        };
        ws.onmessage = function (e) {
            let data = e.data || null
            data = JSON.parse(data)
            // console.log(data);
            switch (data.type) {
                case "self": that.onSelf(data.data); break;
                case "sys": that.onsys(data.data); break;
                case "peer": that.onPeer(data.data); break;
            };
        };
        ws.onclose = function () {
            that.inited = false
            console.log('Connection lost');
            that.emit('stop')
        };

        // 缓存原始send方法
        let send = ws.send;
        // 包装send方法
        ws.send = function (data) {
            // send.call(this, data);
            send.call(this, JSON.stringify(data));
            // console.log(data)
            console.log(`websocket send: ${data.type}`, data.data);
        };
    },
    // 重置状态
    reset() {
        this.inited = false
        this.ws.onopen = null
        this.ws.onmessage = null
        this.ws.onerror = null
        this.ws.onclose = null
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.close()
        }
        this.ws = null
        this.listeners = {}
    },
    // 发给自己的消息
    onSelf(data) {
        // 是否是join事件
        if (data.type === 'join') {
            console.log(`join room ${data.code === 200 ? 'success' : 'failed'}`)
            if (data.code === 200) {
                this.emit('connected', {
                    status: true,
                    wss: this.ws.url
                })
                this.user = data.user
                return
            }
            this.emit('connected', {
                status: false,
                error: data.error
            })
        }
    },
    // 系统消息
    onsys(data) {
        // 如果有人加入则开始rtc连接
        if (data.code === 200 && data.type === 'in') {
            this.emit('start')
        }
        // 有人退出就断开rtc连接
        if (data.code === 200 && data.type === 'out') {
            this.emit('leave', data.data)
        }
    },
    // peer消息
    onPeer(data) {
        // let {type, data} = data
        if (!data.type) return
        this.emit(data.type, data.data)
    },
    // 给服务端发送peer消息
    send(type, data) {
        data = {
            type: 'peer',
            data: {
                type,
                data
            }
        }
        this.ws.send(data);
    },
    join() {
        if (!this.roomId) return
        this.ws.send({
            type: 'join',
            data: {
                roomId: this.roomId
            }

        })
    },
    sendPeer() {
        this.ws.send({
            type: 'peer',
            data: {
                status: 'ready',
                data: 222
            }
        })
    },
    stop() {
        if (!this.ws) return
        this.ws.send({
            type: 'leave',
            data: this.user
        })
        this.reset();
    }
}