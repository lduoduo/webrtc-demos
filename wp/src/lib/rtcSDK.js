/**
 * rtc功能SDK，created by lduoduo
 * 注：API目前还在完善中，尚未完成!
 * 功能：通过rtc帮助传输媒体流和data数据
 * 调用方式：
 * 1. 新建实例 var rtc = new rtcSDK()
 * 2. 初始化，可以传入媒体流或者data数据，可选
 *      rtc.init({
 *          url: 信令服务器地址，必填
 *          roomId: 房间号码，必填
 *          mediastream: 媒体流，可选
 *          data: 自定义data数据，可选
 *      }).then(supportedListeners=>{
 *          // 回调返回的supportedListeners是目前SDK支持的事件注册名
 *          console.log('支持的事件注册列表:',supportedListeners)
 *      })
 *    初始化成功之后，会有属性标志位:inited:true
 * 3. 注册回调监听函数
 *      // 监听远程媒体流
 *      rtc.on('stream', function (mediastream) {
 *          console.log(mediastream)
 *      }.bind(this))
 *      rtc.on('data', function (data) {
 *          console.log(data)
 *      }.bind(this))
 *      // 连接成功回调
 *      rtc.on('ready', function (obj) {
 *          let {status, error, wss} = obj
 *          status: 连接成功失败的状态
 *          console.log(obj)
 *      }.bind(this))
 *      // 远程断开监听
 *      rtc.on('stop', function (obj) {
 *          console.log(obj)
 *      }.bind(this))
 * 4. 可调用的方法
 *      - rtc.updateStream(stream) // 更新流，用新的流代替旧的流，如果不传参，代表销毁流
 *      - rtc.sendMessage(data) // 发送文字聊天
 *      - rtc.sendFile(file) // 发送文件
 *      - rtc.sendText(data) // 发送自定义纯文本
 *      - rtc.updateData(data) // 传递自定义数据，目前没有任何限制(已废弃，不推荐使用)
 */

/******************************SDK START************************************ */

(function () {
    require('webrtc-adapter')
    let support = require('./rtcPolify');
    let signal = require('./rtcSignal');
    let sdpUtil = require('./rtcSdpUtil');

    // 不允许改的属性, rtc当前的状态
    const RTC_STATUS = {
        'new': '0', // 刚初始化，还未开启
        'opened': '1', // 已开启，还未连接
        'connected': '2' //双方连接成功
    }

    // 指定dataChannel数据发送的规则
    const RTC_DATA_TYPE = {
        'text': '1', // '纯文本数据,默认类型,对端接收只打印不作处理',
        'notify': '2', //'通知类数据,场景：发送特殊格式的数据需要提前告知对方注意接收',
        'command': '3', //'命令相关，向后扩展白板等',
        'message': '4', //'聊天内容',
        'other': '5' //'替补类型,暂时无用,未完待续'
    }

    // 指定dataChannel数据发送的规则的反解析
    const RTC_DATA_TYPE_RV = {
        1: 'text', // '纯文本数据,默认类型,对端接收只打印不作处理',
        2: 'notify', //'通知类数据,场景：发送特殊格式的数据需要提前告知对方注意接收',
        3: 'command', //'命令相关，向后扩展白板等',
        4: 'message', //'聊天内容',
        5: 'other' //'替补类型,暂时无用,未完待续'
    }

    // 指定dataChannel接收数据后的方法分发
    const RTC_DATA_TYPE_FN = {
        'text': 'onText', // '纯文本数据, 默认类型, 对端接收只打印不作处理',
        'notify': 'onNotify', //'通知类数据,场景：发送特殊格式的数据需要提前告知对方注意接收',
        'command': 'onCommand', //'命令相关，向后扩展白板等',
        'message': 'onMessage', //'聊天内容',
        'other': 'onOther' //'替补类型,暂时无用,未完待续'
    }

    // 开始构造函数
    function rtcSDK() {
        this.rtcConnection = null;
        // 默认开启的长连接通道
        this.dataChannel = null;
        // 特殊需求时候开启的别的通道
        this.rtcDataChannels = {};
        // 待发送的iceoffer
        this.ice_offer = [];
        this.stream = null;
        this.inited = false;
        // 状态：刚初始化
        this.rtcStatus = RTC_STATUS['new'];

        this.supportedListeners = {
            'ready': '连接成功的回调',
            'stream': '收到远端流',
            'data': '收到远端datachannel数据',
            'stop': '远端断开',
            'text': '收到纯文本消息',
            'message': '收到聊天信息',
            'command': '收到指令',
            'notify': '收到通知',
            'sendFile': '文件发送中的实时状态',
            'receiveFile': '文件接收中的实时状态',
            'sendBuffer': '发送ArrayBuffer实时状态',
            'receiveBuffer': '接收ArrayBuffer实时状态',
            'sendBlob': '发送Blob实时状态',
            'receiveBlob': '接收Blob实时状态'
        }
        // 回调监听
        this.listeners = {}

        this.duoduo_signal = signal
    }

    rtcSDK.prototype = {
        // 临时的远程数据，用于存放接收特殊格式数据，数据接收完毕回传后删除!
        remoteTMP: {},
        // 注册监听回调事件
        on(name, fn) {
            this.listeners[name] = fn
        },
        // 执行回调
        emit(name, data) {
            this.listeners[name] && this.listeners[name](data)
        },
        // 初始化入口
        init(option = {}) {
            // 先校验平台适配情况

            if (!support.support) return Promise.reject('当前浏览器不支持WebRTC功能')

            let { url, roomId, stream, data} = option

            if (!url) return Promise.reject('缺少wss信令地址')
            if (!roomId) return Promise.reject('缺少房间号码')

            this.stream = stream;
            this.data = data;

            this.duoduo_signal.init({ url, roomId });
            if (this.inited) {
                this.updateStream()
                return Promise.reject('请勿重复开启rtc连接')
            }
            this.duoduo_signal.on('connected', this.connected.bind(this))
            this.duoduo_signal.on('start', this.start.bind(this))
            this.duoduo_signal.on('stop', this.stop.bind(this))
            this.duoduo_signal.on('candidate', this.onNewPeer.bind(this))
            this.duoduo_signal.on('offer', this.onOffer.bind(this))
            this.duoduo_signal.on('answer', this.onAnswer.bind(this))

            return Promise.resolve(this.supportedListeners)
        },
        // 断开连接, 进行销毁工作
        stop(data) {
            if (!this.inited) return

            this.emit('stop', data)

            if (this.dataChannel) this.closeChannel(this.dataChannel)

            for (let i in this.rtcDataChannels) {
                this.closeChannel(this.rtcDataChannels[i])
            }

            if (this.rtcConnection && this.rtcConnection.signalingState !== 'closed') this.rtcConnection.close()

            this.rtcConnection = null
            this.dataChannel = null
            this.rtcDataChannels = {}

            this.duoduo_signal.stop()

            let stream = this.stream
            if (stream) {
                stream.getTracks().forEach(function (track) {
                    track.stop()
                    stream.removeTrack(track)
                })
            }
            this.stream = null
            this.listeners = {}
            this.inited = false
        },
        connected(option = {}) {
            let {status, wss, error} = option
            if (status) {
                this.setup(wss)
                return
            }
            this.emit('ready', { status: false, error })
        },
        // 初始化rtc连接，做准备工作
        setup(wss) {
            let rtcConnection;
            if (navigator.mozGetUserMedia) {
                rtcConnection = this.rtcConnection = new RTCPeerConnection();
            } else {
                rtcConnection = this.rtcConnection = new RTCPeerConnection(null, {
                    optional: [{
                        googCpuOveruseDetection: false
                    }, {
                        // DTLS/SRTP is preferred on chrome
                        // to interop with Firefox
                        // which supports them by default
                        DtlsSrtpKeyAgreement: true
                    }
                    ]
                });
            }

            console.log(`${this.getDate()} setup peerconnection`)
            /** 初始化成功的标志位 */
            this.inited = true;

            let stream = this.stream
            if (stream) {
                // stream.getTracks().forEach((track) => {
                //     rtcConnection.addTrack(track, stream)
                // })
                rtcConnection.addStream(stream)
                console.log(`${this.getDate()} attach stream:`, stream)
            }

            // 开启datachannel通道
            this.dataChannel = rtcConnection.createDataChannel("ldodo", { negotiated: true, id: "ldodo" });
            this.onDataChannel(this.dataChannel);

            this.initPeerEvent();

            this.rtcStatus = RTC_STATUS['opened']
            this.emit('ready', { status: true, url: wss })
        },
        // 初始化注册peer系列监听事件
        initPeerEvent() {
            let rtcConnection = this.rtcConnection, that = this;

            // 远端流附加了轨道
            rtcConnection.ontrack = function (event) {
                let stream = event.streams[0]
                console.log(`${that.getDate()} get remote track`, stream);

                // that.emit('stream', stream)
            };

            /** 远端流过来了, 新建video标签显示 */
            rtcConnection.onaddstream = function (event) {

                console.log(`${that.getDate()} get remote stream`, event.stream);
                that.emit('stream', event.stream)

            };

            rtcConnection.onremovestream = function (e) {

                console.log(`${that.getDate()} on remove stream`, arguments);
            }

            /** 设置本地sdp触发本地ice */
            rtcConnection.onicecandidate = function (event) {

                if (event.candidate) {
                    // 丢掉TCP，只保留UDP
                    if (/tcp/.test(event.candidate.candidate)) return

                    console.log(`${that.getDate()} on local ICE: `, event.candidate);

                    // 先缓存，在sdp_answer回来之后再发ice_offer
                    that.ice_offer.push(event.candidate)
                    // that.duoduo_signal.send('candidate', event.candidate);
                } else {
                    console.log(`${that.getDate()} onicecandidate end`);
                }
            };

            rtcConnection.onnegotiationneeded = function (event) {
                console.log(`${that.getDate()} onnegotiationneeded`, event);
            };

            /** 对接收方的数据传递设置 */
            rtcConnection.ondatachannel = function (e) {
                let id = e.channel.id
                let label = e.channel.label

                console.log(`${that.getDate()} on remote data channel ${label} ---> ${id}`);

                that.rtcDataChannels[label] = e.channel
                console.log(`${that.getDate()} data channel state: ` + e.channel.readyState);

                // 对接收到的通道进行事件注册!
                that.onDataChannel(that.rtcDataChannels[label]);
            };

            rtcConnection.oniceconnectionstatechange = function () {
                let state = rtcConnection.iceConnectionState
                console.log(`${that.getDate()} ice connection state change to: `, state);
                if (state === 'connected') {
                    console.log(`${that.getDate()} rtc connect success`)
                    that.rtcStatus = RTC_STATUS['connected']
                }
                if (that.dataChannel) {
                    console.log(`${that.getDate()} data channel state: ` + that.dataChannel.readyState);
                }
            };
        },
        // 真正开始连接
        start() {

            console.log(`${this.getDate()} 开始连接, 发出链接邀请`);
            let rtcConnection = this.rtcConnection
            let that = this

            this.createOffer().catch(err => {
                console.error(err)
            })

        },
        // 发起offer呼叫
        createOffer() {
            let that = this
            let rtcConnection = this.rtcConnection
            let config = {
                offerToReceiveAudio: 1,
                offerToReceiveVideo: 1,
                voiceActivityDetection: false
                // iceRestart: true
            };
            return rtcConnection.createOffer(config).then(function (_offer) {

                // 协议更改，统一vp9编解码格式
                _offer.sdp = sdpUtil.maybePreferVideoReceiveCodec(_offer.sdp, { videoRecvCodec: 'VP9' });

                // 测试打印sdp!后期删除1
                Mt.alert({
                    title: 'offer',
                    msg: `<div style="text-align:left;">${sdp(_offer.sdp)}</div>`,
                    html: true,
                    confirmBtnMsg: '好'
                });

                console.log(`${that.getDate()} create offer success`, _offer);

                return that.setLocalDescription('offer', _offer).then(() => {
                    console.log(`${that.getDate()} after setLocalDescription offer, rtcConnection.localDescription:`, rtcConnection.localDescription)
                    that.duoduo_signal.send('offer', _offer);
                    return Promise.resolve()
                })

            }).catch((error) => {

                console.error(`${that.getDate()} An error on startPeerConnection:`, error)
                let offer = rtcConnection.localDescription
                if (!offer) return Promise.reject('no offer');

                return that.setLocalDescription('offer', offer).then(() => {
                    console.log(`${that.getDate()} after setLocalDescription offer, rtcConnection.localDescription:`, rtcConnection.localDescription)
                    that.duoduo_signal.send('offer', offer);
                    return Promise.resolve()
                })

            })
        },
        createAnswer() {
            let that = this
            let rtcConnection = this.rtcConnection

            return rtcConnection.createAnswer().then((_answer) => {

                console.log(`${that.getDate()} create answer:`, _answer)

                // 协议更改，统一vp9编解码格式
                _answer.sdp = sdpUtil.maybePreferVideoReceiveCodec(_answer.sdp, { videoRecvCodec: 'VP9' });
                // 改动请见：https://stackoverflow.com/questions/34095194/web-rtc-renegotiation-errors
                // _answer.sdp = _answer.sdp.replace(/a=setup:active/gi, function (item) {
                //     return 'a=setup:passive'
                // })
                // _answer.sdp.replace(/a=setup:active/gi, 'a=setup:passive');

                // 测试打印sdp!后期删除1
                Mt.alert({
                    title: 'answer',
                    msg: `<div style="text-align:left;">${sdp(_answer.sdp)}</div>`,
                    html: true,
                    confirmBtnMsg: '好'
                });

                return that.setLocalDescription('answer', _answer).then(() => {
                    console.log(`${that.getDate()} after setLocalDescription answer, rtcConnection.localDescription:`, rtcConnection.localDescription)
                    that.duoduo_signal.send('answer', _answer);
                    return Promise.resolve();
                })
            })
        },
        /**
         * 设置本地会话内容sdp
         * 
         * @param {any} type offer还是answer
         * @param {any} data sdp内容
         * @returns {Promise}
         */
        setLocalDescription(type, data) {
            let rtcConnection = this.rtcConnection
            console.log(`${this.getDate()} setLocalDescription ${type}:`, data)
            return rtcConnection.setLocalDescription(new RTCSessionDescription(data))
        },
        setRemoteDescription(type, data) {
            let rtcConnection = this.rtcConnection
            console.log(`${this.getDate()} setRemoteDescription ${type}:`, data)
            return rtcConnection.setRemoteDescription(new RTCSessionDescription(data))
        },
        /** 将对方加入自己的候选者中 */
        onNewPeer(candidate) {
            // var candidate = data.data;
            this.rtcConnection.addIceCandidate(new RTCIceCandidate(candidate));
        },
        /** 接收链接邀请，发出响应 */
        onOffer(offer) {
            console.log(`${this.getDate()} on remote offer`, offer);

            // 协议更改，统一vp9编解码格式
            offer.sdp = sdpUtil.maybePreferVideoSendCodec(offer.sdp, { videoRecvCodec: 'VP9' });

            this.setRemoteDescription('offer', offer).then(() => {
                return this.createAnswer()
            }).catch((error) => {
                console.error(`${this.getDate()} onOffer error:`, error)
            })
        },
        /** 接收响应，设置远程的peer session */
        onAnswer(answer) {
            console.log(`${this.getDate()} on remote answer`, answer)

            // 协议更改，统一vp9编解码格式
            answer.sdp = sdpUtil.maybePreferVideoSendCodec(answer.sdp, { videoRecvCodec: 'VP9' });

            this.setRemoteDescription('answer', answer).then(() => {
                // 开始发送ice_offer
                let iceOffers = this.ice_offer
                if (iceOffers.length > 0) {
                    iceOffers.forEach((item) => {
                        this.duoduo_signal.send('candidate', item);
                    })
                }
                this.ice_offer = []
            }).catch(function (e) {
                console.error(e);
            });
        },
        // 实时更新媒体流
        updateStream(stream) {
            if (!stream) stream = new MediaStream()
            if (stream.stream) stream = stream.stream
            let rtcConnection = this.rtcConnection

            var audioOld, videoOld, audio, video

            audio = stream.getAudioTracks()[0]
            video = stream.getVideoTracks()[0]

            // 卸载所有轨道和流
            if (!audio && !video) {
                if (!this.stream) return

                // Firefox模式
                if (rtcConnection.removeTrack) {
                    this.rtcAudioTrack && rtcConnection.removeTrack(this.rtcAudioTrack)
                    this.rtcVideoTrack && rtcConnection.removeTrack(this.rtcVideoTrack)
                } else {
                    rtcConnection.removeStream(this.stream)
                }

                if (this.rtcStatus === RTC_STATUS['connected']) {
                    this.createOffer()
                }

                return

            }

            // 第一次附加
            // if (!this.stream) {
                this.stream = stream

                // Firefox模式
                if (rtcConnection.addTrack) {
                    this.rtcAudioTrack = audio ? rtcConnection.addTrack(audio, stream) : null
                    this.rtcVideoTrack = video ? rtcConnection.addTrack(video, stream) : null
                } else {
                    rtcConnection.addStream(stream)
                }

                if (this.rtcStatus === RTC_STATUS['connected']) {
                    this.createOffer()
                }

                // return
            // }

            // // 更新流
            // let tmp = rtcConnection.getLocalStreams()
            // tmp = tmp.length > 0 ? tmp[0] : null
            // console.log(`当前rtc轨道数目`, tmp, (tmp && tmp.getTracks().length))

            // // 先取所有轨道
            // audioOld = this.stream.getAudioTracks()[0]
            // videoOld = this.stream.getVideoTracks()[0]
            // audio = stream.getAudioTracks()[0]
            // video = stream.getVideoTracks()[0]

            // // 新加轨道
            // if (!audioOld) {
            //     audio && this.stream.addTrack(audio)
            // }

            // if (!videoOld) {
            //     video && this.stream.addTrack(video)
            // }

            // // 更新音频轨道
            // if (audioOld) {
            //     // 移除轨道
            //     if (!audio) {
            //         this.stream.removeTrack(audioOld)
            //     } else {
            //         // 更新轨道
            //         if (audio !== audioOld) {
            //             this.stream.removeTrack(audioOld)
            //             this.stream.addTrack(audio)
            //         }
            //     }
            // }

            // // 更新视频轨道
            // if (videoOld) {
            //     // 移除轨道
            //     if (!video) {
            //         this.stream.removeTrack(videoOld)
            //     } else {
            //         // 更新轨道
            //         if (video !== videoOld) {
            //             this.stream.removeTrack(videoOld)
            //             this.stream.addTrack(video)
            //         }
            //     }
            // }

            // tmp = rtcConnection.getLocalStreams()
            // tmp = tmp.length > 0 ? tmp[0] : null

            // tmp = rtcConnection.getLocalStreams()
            // tmp = tmp.length > 0 ? tmp[0] : null

            // console.log(`更新后rtc轨道数目`, tmp, (tmp && tmp.getTracks().length))

            // if (this.rtcStatus === RTC_STATUS['connected']) {
            //     this.createOffer().catch(err => {
            //         console.error(err)
            //     })
            // }

        },
        // 实时更新data
        /**
         * 实时更新data
         * 需要对数据格式做验证
         * 1. blob格式的传输，新建Blob通道，最后一次传输完毕进行关闭
         * 2. arraybuffer格式的传输，新建arraybuffer通道，最后一次传输完毕进行关闭
         * 3. 其他格式的数据通通以json格式传输，默认只开启一个长连接通道进行传输
         * 4. 这里需要注意频繁关闭通道会不会有性能问题，需要调研!
         * 5. 对于特殊格式的数据，需要包装一下，注明type和通道id
         * 这里需要返回一个promise，用于记录如果是特殊格式的传输回传的通道id
         * 参数注解:
         * 注: 当特殊格式的数据传输完毕，请手动调用一次，data.data设置为Null
         * {
                type: '数据类型', // 自定义，用于接收端解析
                channelType: '通道类型', // 注明是ArrayBuffer还是Blob，如果这两种都不是，不用注明
                channelId: '通道id', //当传真正的特殊格式数据时，需要传递该参数
                data: Any //真正需要传递的数据
            }
            注：销毁通道由接收方进行
            注：如果需要申请长连接，创建后不再关闭通道，需要传递一个参数 channelLife: 'long'，默认是短连接
         */

        updateData(data) {
            let that = this
            if (!this.rtcConnection || !this.dataChannel) return Promise.reject('no rtc connection')
            if (data.constructor === Object) {
                // 是否是特殊格式的传输
                if (data.data && /(Blob|ArrayBuffer)/.test(data.data.constructor)) {
                    if (!data.channelId) return Promise.reject('no channelId')
                    let tmp = this.rtcDataChannels[data.channelId]
                    console.log(`${this.getDate()} send ArrayBuffer`)

                    if (!tmp || tmp.readyState !== 'open') {
                        return Promise.reject(`${tmp ? 'dataChannel state error:' + tmp.readyState : 'dataChannel destroyed already'}`)
                    }

                    tmp.send(data.data);
                    return Promise.resolve()
                }
                // 是否需要新建通道
                let channelId
                if (/(Blob|ArrayBuffer)/.test(data.channelType)) {
                    return this.createChannel({ label: data.channelType }).then((channelId) => {
                        data.channelId = channelId
                        next();
                        return Promise.resolve(channelId)
                    })
                }

                next();

                function next() {
                    console.log('next', data)
                    // 普通数据传递
                    data = JSON.stringify(data)

                    if (that.dataChannel.readyState !== 'open') return Promise.reject('dataChannel state error')
                    that.dataChannel.send(data);
                }
                return Promise.resolve()

            }
            if (this.dataChannel.readyState !== 'open') return Promise.reject('dataChannel state error')
            console.log('normal', data)
            this.dataChannel.send(JSON.stringify(data));
            return Promise.resolve()
        },
        // 新建通道
        /**
         * 为了防止新建通道刚刚建立还未注册事件就发送数据，导致对端收不到数据，这里需要做个防抖，采用promise
         * 对外公开的API
         * option.label: 通道名字
         * option.channelStatus: 连接类型：long:长连接，数据发送完毕不会关闭, short(默认值): 短连接，数据发送完毕立即关闭销毁
         * option.channelType: 发送的数据类型，目前有ArrayBuffer / Blob(目前chrome还不支持该类型)，可选
         * option.type: 传输内容的类型，用于接收端解析，目前有文件，图片什么的
         * option.data: 里面包含该文件的具体信息，比如name / size等等
         */
        createChannel(option = {}) {
            if (!this.rtcConnection) return Promise.reject('no rtc connection')

            let {label, channelStatus = 'short'} = option

            if (!label) return Promise.reject('missing parameter: label')

            label = label + Date.now()
            // let name = label + Date.now()
            label = channelStatus + '-' + label
            let dataChannel = this.rtcConnection.createDataChannel(label, { ordered: true });
            this.rtcDataChannels[label] = dataChannel

            this.onDataChannel(dataChannel)
            console.log(`${this.getDate()} 建立通道: ${label} ---> ${dataChannel.id}`)
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve(label)
                }, 1000)
            })
            // .then((label) => {
            //     let sendData = {
            //         type: type,
            //         channelId: label,
            //         channelType: channelType,
            //         data: data
            //     }
            //     sendData = JSON.stringify(sendData)

            //     if (this.dataChannel.readyState !== 'open') return Promise.reject('dataChannel state error')
            //     this.dataChannel.send(sendData);
            //     return Promise.resolve(label)
            // })
        },
        /** 获取格式化日期接口 */
        getDate() {
            let now = new Date()
            now = now.toLocaleString()
            return now + ' ---- '
        },
        /**
         * dataChannel事件监听
         * 由于有可能有多个通道，这里需要传入需要注册事件的通道
         * 
         */
        onDataChannel(channel) {
            let that = this
            // console.log(`${that.getDate()} 通道事件注册:`, channel)
            channel.onopen = function () {
                console.log(`${that.getDate()} ${channel.id} --> dataChannel opened, ready now`);
            };
            channel.onerror = function (error) {
                console.error(`${that.getDate()} ${channel.id} --> dataChannel error:`, error);
            };
            channel.onmessage = function (event) {

                let data = event.data

                if (data.constructor === String) data = JSON.parse(data)

                // 如果是短连接, 数据发送完毕后关闭通道
                if (!data && channel.label in that.rtcDataChannels && /^short-/.test(channel.label)) {
                    that.closeChannel(channel)
                    return
                }

                if (/(Blob|ArrayBuffer)/.test(data.constructor)) data = { channelId: channel.label, data }

                that.onRemoteData(data)

            };
            channel.onclose = function (data) {
                console.warn(`${that.getDate()} ${channel.id} --> dataChannel closed now`);
                // 关闭自己端的通道
                that.closeChannel(channel)
            };
        },
        /**
         * 关闭通道
         * 由于有可能有多个通道，这里需要参数指定
         * 参数注解，channel可以为channelLabel，也可以是dataChannel实体
         */
        closeChannel(channel) {
            if (!channel) return
            if (channel.constructor !== RTCDataChannel) {
                channel = this.rtcDataChannels[channel]
            }
            if (!channel) return
            console.log(`${this.getDate()} 销毁通道: ${channel.label} --> ${channel.id}`)
            channel.close();
            channel.onopen = null
            channel.onerror = null
            channel.onmessage = null
            channel.onclose = null
            this.rtcDataChannels[channel.label] = null
        },

        /*****************以下是收发各种数据格式的API, API将成对出现**********************************/

        /** 
         * 真正发送数据的接口, 数据在发送前和接收后进行装载和卸载处理，处理后再回传给客户端
            option = {
                // 发送的数据类型
                type: RTC_DATA_TYPE,
                // 真正的自定义数据，接收端自己解析
                data,
                // 发送数据的通道，如果不传，默认使用初始化时开启的通道
                channel
            }
         */

        sendData(option = {}) {
            let {type, data, channel} = option
            if (!type || !data) return Promise.reject('sendData error: invalid parameter')
            if (!channel) channel = this.dataChannel

            if (!channel || channel.readyState !== 'open') {
                return Promise.reject(`${channel ? 'dataChannel state error:' + channel.readyState : 'dataChannel destroyed already'}`)
            }
            option = JSON.stringify(option)
            channel && channel.send(option);
            return Promise.resolve()
        },
        /** 接收远程数据 **/
        onRemoteData(result) {

            // console.log(`${this.getDate()} get remote data:`, result);

            // 纯字符串数据被丢弃，理论上不应该有这种格式的数据
            if (result.constructor !== Object) return

            let {type, channelId, data} = result

            let fn = type && RTC_DATA_TYPE_RV[type] && RTC_DATA_TYPE_FN[RTC_DATA_TYPE_RV[type]]

            // 五种数据发送规则类型的处理
            if (fn) {
                return this[fn] && this[fn]({ channelId: channelId, data: data })
            }

            // 特殊格式的数据接收
            if (channelId && data && data.constructor === ArrayBuffer) {
                return this.onBuffer(result)
            }

        },
        /** 接口，发送普通text */
        sendText(data) {
            data = { data: data }
            return this.sendData({ type: RTC_DATA_TYPE['text'], data })
        },
        /** 接收普通text */
        onText(data) {
            data = data.data.data
            this.emit('text', data)
        },
        /** 发送聊天内容 */
        sendMessage(data) {
            data = { data: data }
            return this.sendData({ type: RTC_DATA_TYPE['message'], data })
        },
        /** 接收聊天内容 */
        onMessage(data) {
            console.log(data)
            data = data.data.data
            this.emit('message', data)
        },
        /** 
         * 发送通知
         * 一般用于通知对方即将开启通道发送Blob、ArrayBuffer
         * 发送通知前都会创建一个对应的dataChannel通道
         */
        sendNotify(data) {
            let that = this
            if (!data || !data.channelType) return Promise.reject('sendNotify error: invalid parameter data')
            if (/(Blob|ArrayBuffer)/.test(data.channelType)) {
                return this.createChannel({ label: data.channelType }).then((channelId) => {
                    data.channelId = channelId
                    next();
                    return Promise.resolve(channelId)
                })
            }

            function next() {
                console.log(`${that.getDate()} sendNotify:`, data)
                that.sendData({ type: RTC_DATA_TYPE['notify'], data })
            }
        },
        /** 接收通知，进行处理 */
        onNotify(result) {
            console.log(`${this.getDate()} onNotify:`, result)
            // 是否是接收特殊数据的通知
            let {channelId, data} = result
            let {type} = data

            // 初始化文件接收工作
            if (type && /(file|image|canvas)/.test(type) && data.channelId) {
                let tmp = this.remoteTMP[data.channelId] = {}
                tmp.size = data.size
                tmp.currentSize = 0
                tmp.name = data.name
                tmp.type = type
                tmp.buffer = []
                return
            }

            // 普通通知，直接回传
            this.emit('notify', data)
        },
        /** 发送ArrayBuffer */
        sendBuffer(data) {
            if (!data || !data.constructor === Object) return Promise.reject('sendBuffer error: invalid data')
            if (data.data && /(Blob|ArrayBuffer)/.test(data.data.constructor)) {
                if (!data.channelId) return Promise.reject('no channelId')
                let tmp = this.rtcDataChannels[data.channelId]

                // console.log(`${this.getDate()} send ArrayBuffer`)

                if (!tmp || tmp.readyState !== 'open') {
                    return Promise.reject(`${tmp ? 'dataChannel state error:' + tmp.readyState : 'dataChannel destroyed already'}`)
                }

                tmp.send(data.data);
                return Promise.resolve()
            }
        },
        /** 接收ArrayBuffer接口 */
        onBuffer(result = {}) {
            // console.log(result)

            let {channelId, data} = result
            if (!channelId || data.constructor !== ArrayBuffer) return

            let tmp = this.remoteTMP[channelId]
            // let {name, size, currentSize, buffer} = tmp

            tmp.buffer.push(data);
            tmp.currentSize += data.byteLength;

            if (tmp.currentSize === tmp.size) {
                // this.showReceivedFile(tmp)
                tmp.isDone = true
            }

            // 接收状态同步回传
            tmp.type === 'file' && this.emit('receiveFile', tmp)
            tmp.type === 'blob' && this.emit('receiveBlob', tmp)
            tmp.type === 'buffer' && this.emit('receiveBuffer', tmp)

            // 文件接收完毕，进行销毁工作
            if (tmp.isDone) {

                delete this.remoteTMP[channelId]

                // 如果是短连接, 数据发送完毕后关闭通道
                if (channelId in this.rtcDataChannels && /^short-/.test(channelId)) {
                    this.closeChannel(channelId)
                    return
                }
            }
        },
        /** 发送文件接口 */
        sendFile(file) {

            if (!file || file.constructor !== File) return Promise.reject('sendFile error: parameter invalid')
            if (!this.inited) return Promise.reject('sendFile error: no rtc connection')

            let that = this
            let size = file.size;
            let name = file.name;
            let chunkSize = 100000;
            // let chunkSize = 16384;
            let channelId = null;
            return this.sendNotify({
                type: 'file',
                channelType: 'ArrayBuffer',
                name,
                size,
                chunkSize
            }).then(cid => {

                if (!cid) return

                channelId = cid
                sliceFile(0);

                return Promise.resolve()
            })

            function sliceFile(offset) {
                var reader = new FileReader();
                reader.onload = (function () {
                    return function (e) {
                        let data = e.target.result
                        let currentSize = offset + e.target.result.byteLength
                        that.sendBuffer({ channelId, data }).then(() => {

                            if (file.size > offset + e.target.result.byteLength) {
                                setTimeout(sliceFile, 0, offset + chunkSize);
                            }

                            // 发送状态同步回传
                            that.emit('sendFile', { name, size, currentSize })

                        }).catch(err => {
                            console.error(err)
                        })

                    };
                })(file);
                var slice = file.slice(offset, offset + chunkSize);
                reader.readAsArrayBuffer(slice);
            };

        },
        /** 发送Blob数据接口 */
        sendBlob() {

        }
    }


    /****************API对外暴露部分*************** */
    window.rtcSDK = rtcSDK

})();

/******************************SDK END************************************ */

/** 测试用 */
window.sdp = function (str) {
    if (!str) return
    var reg = /(v=|o=[^0-9]|s=-|t=0|a=|b=|c=I|m=|t=0)\w{0,1}/gi
    // var res = str.match(reg)
    var res = str.replace(reg, function (item) {
        return '<br>\r\n' + item
        // console.log(item)
    })
    // console.log(res)
    return res
}

