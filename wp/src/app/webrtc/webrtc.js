/** web rtc demo */
/**
 * 目前只支持2个client的p2p链接，即每个房间只支持2个人
 * 角色A: 第一个进入房间的人，处于等待状态，是p2p链接发起方
 * 角色B: 第二个进入房间的人，是配p2p链接接收方
 * 链接步骤：
 * 1. 角色成功加入房间(失败的时候另寻房间)
 * 2. 初始化本地媒体流
 *    - 检测是否有摄像头，是否支持
 *    - 获取本地视频流, navigator.getUserMedia
 *    - 初始化本地视频流信息, 以video标签进行渲染
 *    - 初始化本地p2p链接信息: new RTCPeerConnection(第三方STUN服务器配置信息);
 *    - 本地peer链接信息加入本地视频流进行渲染
 *    - 初始化本地peer的一系列事件
 *      - onicecandidate: 本地设置sdp时会触发, 生成保存自己的候选人信息
 *      - 通过服务器发送 candidate 给对方
 *      - onaddstream: 当有流过来时触发, 接收流并渲染
 * 3. 如果房间内人数为2，服务器通知房间里的A发起p2p连接请求
 * 4. A创建自己的链接邀请信息, 设置本地链接信息sdp, 通过服务器发送给B
 *    - createOffer: 创建本地链接信息
 *    - setLocalDescription: 将offer设置为本地链接信息sdp, 并且触发本地peer的onicecandidate事件
 * 4. server转发offer链接邀请信息给B, 触发B的onOffer方法进行处理
 *    - setRemoteDescription: 接收A的链接邀请，并设置A的描述信息, XXX.setRemoteDescription(new RTCSessionDescription(offer))
 *    - createAnswer: 创建回应，并存储本地的回应信息, 并将回应发送给server
 *    - setLocalDescription, 将自己的创建的answer设置为本地连接信息sdp, 触发自己的本地onicecandidate事件
 * 5. server转发候选人信息candidate, 触发B的onNewPeer(自定义的方法)
 *    - addIceCandidate: 将A的候选人信息加入自己本地, XXX.addIceCandidate(new RTCIceCandidate(candidate));
 * 6. A通过server接收B发出的answer, 触发自己的onAnswer
 *    - 设置B的描述信息, XXX.setRemoteDescription(new RTCSessionDescription(answer));
 * 7. AB链接建立完成, 开始传输实时数据
 */

// 引入样式文件
import './webrtc.css';

navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;

window.AudioContext = window.AudioContext || webkitAudioContext;
var actx = new AudioContext();

var canvas = document.createElement('canvas');
canvas.width = 320; canvas.height = 240;
var cctx = canvas.getContext('2d');

var myvideo = document.querySelector('#myrtc');
var uvideo = document.querySelector('#urtc');

var constraints = {

    audio: true,
    video: {
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 },
        frameRate: { ideal: 20, max: 15 },
        // facingMode:
        // {
        //     exact: "environment"
        // }
    }

};

//弹窗插件配置
var Mt = {
    alert: function(option) {
        //type, title, msg, btnMsg, cb, isLoading
        swal({
            title: option.title,
            text: option.msg,
            type: option.type,
            showConfirmButton: !!option.confirmBtnMsg,
            showCancelButton: !!option.cancelBtnMsg,
            cancelButtonText: option.cancelBtnMsg || "在犹豫一下",
            confirmButtonColor: "#DD6B55",
            confirmButtonText: option.btnMsg || "好哒",
            showLoaderOnConfirm: option.isLoading,
            timer: option.timer,
            closeOnConfirm: false,
            html: option.html
        }, option.cb);
    },
    close: function() {
        swal.close();
    }
};

var search = window.location.search;
search = search ? search.match(/roomId=\d+/gi) : "";
search = search ? search[0].replace(/roomId=/gi, '') : "";
//我的本地存储数据
var my = {
    roomId: search,
    info: {},
    //socket是否已经连接好，连接好后才能开启p2p连接
    isReady: false,
    //本地音视频流是否已准备好，准备好后才能进行p2p连接
    // isMediaReady: false,
    list: [],
    addedlist: [],
    //我能连接的所有人
    connectors: {},
    //我自己的p2p连接信息
    rtcConnection: null,
    //我的音频输入设备
    audios: [],
    //我的视频输入设备
    videos: [],
    //我的音视频流
    localStream: {
        video: null,
        audio: null,
        stream: null
    },
    //远程音视频流
    remoteStream: {
        video: null,
        audio: null,
        stream: null
    }
};

var local = localStorage || window.localStorage; //本地存储
// ---------初始化启动socket, 创建socket链接-----------
/** 本地环境的socket协议和线上不一致，需要作区分 !!  */

var socket = null;
if (MY.environment == "dev") {
    socket = io('https://' + window.location.hostname + ':8098', { path: "/rtcSocket", query: 'roomId=' + my.roomId });
} else {
    socket = io.connect({ path: "/rtcSocket", query: 'roomId=' + my.roomId, "transports": ['websocket'] });
}

var rtc = {
    init: function() {
        this.initStatus();
        this.initSocket();
        this.join();
        this.initEvent();
    },
    initEvent: function() {
        var that = this;
        // var shots = $('#snapshot')[0];
        $('body').on('click', '#snapshot', function(e) {
            if (my.stream) {
                cctx.drawImage(myvideo, 0, 0);
                $('#img')[0].src = canvas.toDataURL('image/webp');
            }
        });
        // video click
        $('body').on('click', '.video-fixed .item', function(e) {
            let mySrc = myvideo.srcObject;
            let uSrc = uvideo.srcObject;
            myvideo.srcObject = uSrc;
            uvideo.srcObject = mySrc;
        });
        //video source change
        $('body').on('click', '.J-additional-inputs .item', function(e) {
            constraints.video.optional = [{ sourceId: $(e.target).data('id') }];
            that.initMedia();
        });

        //send msg button click
        $('body').on('click', '.J-send-msg', function(e) {
            var data = $('.J-msg-in').val();
            if (!data) { return; }
            my.dataChannel.send(data);
            $('.J-msg-in').val('');
            that.showMsg(data, true);
        });

        //clean msg button click
        $('body').on('click', '.J-clean-msg', function(e) {
            $('.J-msg').html('');
        });
    },
    //init local data
    initStatus: function() {
        // my.info = JSON.parse(local.getItem('myinfo') || null);
    },
    /************************************socket消息处理相关************************************ */
    //初始化socket的各种监听事件
    initSocket: function() {
        var that = this;
        // 加入房间
        socket.on('connect', function() {
            console.log('heart beat...');
        });
        // 监听消息
        socket.on('msg', function(user, msg) {
            console.log(msg);
        });
        // 监听系统消息
        socket.on('sys', function(sysMsg, data) {
            if (sysMsg == "in") {
                // console.log(data);
                Mt.alert({
                    title: data.id + "来了",
                    timer: 1000
                });
                my.addedlist.push(data);
            }
            if (sysMsg == "out") {
                that.onLeave(data);
            }
            // console.log(my);
        });
        // 监听自己的消息
        socket.on('self', function(sysMsg, data) {
            //要加入的房间已满，重新选择房间
            if (sysMsg == 'error') {
                Mt.alert({
                    title: data,
                    confirmBtnMsg: '好',
                    cb: function() {
                        var id = Math.floor(Math.random() * 1000);
                        var tmp = window.location.href;
                        if (/roomid=\w+/gi.test(tmp)) {
                            tmp = tmp.replace(/(\?)roomid=\w+/gi, '');
                        }
                        window.location.href = tmp + '?roomid=' + id;
                    }
                });
                return;
            }
            my.isReady = true;
            // local.setItem('myinfo', JSON.stringify(data));
            my.info = data;
            console.log('欢迎您加入');
            console.log(data);
            that.initPeerConnection();
        });
        /** 和peer有关的监听 */
        socket.on('peer', function(data) {
            // console.log(data);
            switch (data.type) {
                case "candidate": that.onNewPeer(data.data); break;
                case "offer": that.onOffer(data.data); break;
                case "peerStart": that.startPeerConnection(); break;
                case "answer": that.onAnswer(data.data); break;
            };
        });
    },
    //p2p连接的消息传递
    send: function(type, data) {
        socket.emit('peer', {
            type: type,
            data: {
                user: my.info,
                data: data
            }
        });
    },
    //离开房间
    leave: function() {
        socket.emit('leave');
    },
    //加入房间
    join: function() {
        socket.emit('join', my.info);
    },
    /************************************获取设备和音视频流处理相关************************************ */
    /** 开始获取本地设备列表并获取音视频流 */
    startMedia() {
        let that = this
        return this.getDevices().then(() => {
            that.showInputs()
            return that.getLocalMedia();
        })
    },
    //获取摄像头和麦克风的列表
    getDevices() {
        return new Promise(function(resolve, reject) {
            // 文档见: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                // console.log("your browser not support this feature");
                return reject(new Error("your browser not support this feature, see https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices"));
            }
            navigator.mediaDevices.enumerateDevices().then(function(devices) {
                devices.forEach(function(device, index) {
                    let label
                    if (device.kind === "videoinput") {
                        label = device.label ? device.label : "camera " + (my.videos.length + 1)
                        label = label.substr(0, 10)
                        my.videos.push({
                            deviceId: device.deviceId,
                            label: label
                        });
                    } else if (device.kind === "audioinput") {
                        my.audios.push({
                            deviceId: device.deviceId,
                            label: device.label
                        });
                    }
                });
                return resolve();
            }).catch(function(e) {
                return reject(e);
            });
        });
    },
    //如果有多个视频音频输入，屏幕上进行展示
    showInputs: function() {
        var inputsEL = document.createElement('div');
        inputsEL.className = "item additional-inputs J-additional-inputs";
        var html = "";
        var tmp = null;
        tmp = my.videos[0];
        constraints.video.deviceId = tmp.deviceId;

        // if(my.videos.length <= 1){return;}
        for (var i = 0; i < my.videos.length; i++) {
            tmp = my.videos[i];
            html += "<div class='item' data-id='" + tmp.deviceId + "'>" + tmp.label + "</div>";
        }

        $(inputsEL).html(html);
        $('.J-btn-group').append(inputsEL);
    },
    /** init media */
    getLocalMedia: function() {
        let that = this;
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // 支持
            // console.log(constraints)
            return navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {

                that.formatLocalStream(stream);
                that.startLocalStream();
                return Promise.resolve();
            }).catch((e) => {
                console.log('启动摄像头失败:', e)
                return Promise.reject(e);
            })
        } else {

            return Promise.reject('getUserMedia not supported')
        }
    },
    /** 
     * 格式化处理本地音视频媒体流
     * 音频和视频分开
     */
    formatLocalStream: function(stream) {
        if (!stream) return
        console.log(`format local stream: `, stream)
        let tmpStream = {}

        // tmpStream.stream = tmpStream.stream || new MediaStream()
        tmpStream.stream = stream

        // tmpStream.stream = stream;
        let audioTrack = stream.getAudioTracks()[0]
        let videoTrack = stream.getVideoTracks()[0]

        let oldAoTrack = tmpStream.stream.getAudioTracks()[0]
        let oldVoTrack = tmpStream.stream.getVideoTracks()[0]

        if (audioTrack) {
            if (tmpStream.audio) {
                tmpStream.audio.destroy()
                tmpStream.audio = null
            }
            tmpStream.audio = new MediaStream([audioTrack])
            tmpStream.audio = new webAudio(tmpStream.audio)

            audioTrack = tmpStream.audio.outputStream.getAudioTracks()[0]

            // if (oldAoTrack) {
            //     oldAoTrack !== audioTrack && tmpStream.stream.removeTrack(oldAoTrack) && tmpStream.stream.addTrack(audioTrack)
            // } else {
            //     tmpStream.stream.addTrack(audioTrack)
            // }
        }

        if (videoTrack) {
            tmpStream.video = new MediaStream([videoTrack])

            // if (oldVoTrack) {
            //     oldVoTrack !== videoTrack && tmpStream.stream.removeTrack(oldVoTrack) && tmpStream.stream.addTrack(videoTrack)
            // } else {
            //     tmpStream.stream.addTrack(videoTrack)
            // }
        }

        my.localStream = tmpStream
        console.log('format local done ---> ', my.localStream)
    },
    /** 
     * 格式化处理远程音视频媒体流
     * 音频和视频分开
     */
    formatRemoteStream: function(stream) {
        if (!stream) return
        console.log(`format remote stream: `, stream)
        let tmpStream = {}

        // tmpStream.stream = tmpStream.stream || new MediaStream()
        tmpStream.stream = stream

        // tmpStream.stream = stream;
        let audioTrack = stream.getAudioTracks()[0]
        let videoTrack = stream.getVideoTracks()[0]

        let oldAoTrack = tmpStream.stream.getAudioTracks()[0]
        let oldVoTrack = tmpStream.stream.getVideoTracks()[0]

        if (audioTrack) {
            if (tmpStream.audio) {
                tmpStream.audio.destroy()
                tmpStream.audio = null
            }
            tmpStream.audio = new MediaStream([audioTrack])
            // tmpStream.audio = new webAudio(tmpStream.audio)

            // audioTrack = tmpStream.audio.outputStream.getAudioTracks()[0]

            // if (oldAoTrack) {
            //     oldAoTrack !== audioTrack && tmpStream.stream.removeTrack(oldAoTrack) && tmpStream.stream.addTrack(audioTrack)
            // } else {
            //     tmpStream.stream.addTrack(audioTrack)
            // }
        }

        if (videoTrack) {
            tmpStream.video = new MediaStream([videoTrack])

            // if (oldVoTrack) {
            //     oldVoTrack !== videoTrack && tmpStream.stream.removeTrack(oldVoTrack) && tmpStream.stream.addTrack(videoTrack)
            // } else {
            //     tmpStream.stream.addTrack(videoTrack)
            // }
        }

        my.remoteStream = tmpStream
        console.log('format remote done ---> ', my.remoteStream)
    },
    formatStream1(stream, isRemote = false) {
        let tmpStream = {}
        tmpStream.video = stream
        tmpStream.audio = stream
        tmpStream.stream = stream
        if (isRemote) {
            my.remoteStream = tmpStream
        } else {
            my.localStream = tmpStream
        }
    },
    /** 
     * 格式化处理音视频媒体流
     * 音频和视频分开
     * 已废弃
     */
    formatStream(stream, isRemote = false) {
        if (!stream) return
        console.log(`format ${isRemote ? 'remote' : 'local'} stream: `, stream)
        let tmpStream = isRemote ? my.localStream : my.remoteStream

        // tmpStream.stream = tmpStream.stream || new MediaStream()
        tmpStream.stream = stream

        // tmpStream.stream = stream;
        let audioTrack = stream.getAudioTracks()[0]
        let videoTrack = stream.getVideoTracks()[0]

        let oldAoTrack = tmpStream.stream.getAudioTracks()[0]
        let oldVoTrack = tmpStream.stream.getVideoTracks()[0]

        if (audioTrack) {
            if (tmpStream.audio) {
                tmpStream.audio.destroy()
                tmpStream.audio = null
            }
            tmpStream.audio = new MediaStream([audioTrack])
            tmpStream.audio = new webAudio(tmpStream.audio)

            audioTrack = tmpStream.audio.outputStream.getAudioTracks()[0]

            // if (oldAoTrack) {
            //     oldAoTrack !== audioTrack && tmpStream.stream.removeTrack(oldAoTrack) && tmpStream.stream.addTrack(audioTrack)
            // } else {
            //     tmpStream.stream.addTrack(audioTrack)
            // }
        }

        if (videoTrack) {
            tmpStream.video = new MediaStream([videoTrack])

            // if (oldVoTrack) {
            //     oldVoTrack !== videoTrack && tmpStream.stream.removeTrack(oldVoTrack) && tmpStream.stream.addTrack(videoTrack)
            // } else {
            //     tmpStream.stream.addTrack(videoTrack)
            // }
        }

        if (isRemote) {
            my.remoteStream = tmpStream
            console.log('format remote done ---> ', my.remoteStream)
        } else {
            my.localStream = tmpStream
            console.log('format local done ---> ', my.localStream)
        }
    },
    // 开启本地音视频流外显
    startLocalStream() {
        myvideo.srcObject = my.localStream.video
    },
    // 开启远程音视频流外显
    startRemoteStream() {
        uvideo.srcObject = my.remoteStream.video

        if (my.remoteStream.audioNode) {
            my.remoteStream.audioNode.srcObject = my.remoteStream.audio
            return
        }
        let audioNode = my.remoteStream.audioNode = document.createElement('audio')
        audioNode.srcObject = my.remoteStream.audio
        audioNode.play()
    },
    /************************************RTCPeerConnection连接相关************************************ */
    //init connection
    initPeerConnection: function() {
        if (!hasRTCPeerConnection()) {
            Mt.alert({
                title: "web rtc not supported for connection",
                confirmBtnMsg: '好哒'
            });
            return;
        }
        this.setupPeerConnection();
    },
    setupPeerConnection: function() {
        var that = this;

        if (!my.localStream.stream) {
            console.warn('no mediastream, get local first');
            that.startMedia().then(() => {
                that.setupPeerConnection();
            }).catch((e) => {
                Mt.alert({
                    title: e,
                    confirmBtnMsg: '好哒'
                });
            })
            return;
        }

        //Google的STUN服务器：stun:stun.l.google.com:19302 ??
        var iceServer = {
            "iceServers": [{
                "url": "stun:173.194.202.127:19302"
            }]
        };

        //创建PeerConnection实例
        my.rtcConnection = new RTCPeerConnection(iceServer);
        // my.rtcConnection = new RTCPeerConnection(iceServer, { optional: [{ RtpDataChannels: true }] });
        console.log('setupPeerConnection ---> ', my.rtcConnection);

        // let stream = my.localStream.stream
        console.log('setupPeerConnection ---> attach rtc stream:', my.localStream.stream);
        my.rtcConnection.addStream(my.localStream.stream);

        /** 视频流传递 */
        my.rtcConnection.onaddstream = function(e) {
            let ms = e.stream;
            console.log('rtc receive stream:', ms);
            that.formatRemoteStream(ms);
            that.startRemoteStream();
        };
        /** 设置本地sdp后触发该事件，发送自己的candidate */
        my.rtcConnection.onicecandidate = function(e) {
            if (e.candidate) {
                console.log('onicecandidate ', e);
                my.candidate = e.candidate;
                that.send('candidate', e.candidate);
            } else {
                console.log("onicecandidate end");
            }
        };

        my.rtcConnection.onremovestream = function(e) {
            // that.disableStream(mid);
            console.log("on remove stream", arguments);
        }

        my.rtcConnection.oniceconnectionstatechange = function(e) {
            console.log('iceConnectionState: ' + my.rtcConnection.iceConnectionState);
            if (my.dataChannel) {
                console.log('data channel state: ' + my.dataChannel.readyState);
            }
        };

        my.rtcConnection.onnegotiationneeded = function(event) {
            // mylog("onnegotiationneeded");
            console.log('onnegotiationneeded', event);
        };

        /** 对接收方的数据传递设置 */
        my.rtcConnection.ondatachannel = function(e) {
            console.log('on remote data channel');
            my.dataChannel = e.channel;
            console.log('data channel state: ' + my.dataChannel.readyState);
            that.onDataChannel();
        };

        //做好连接准备后，发送消息给服务器，通知对方发送P2P连接邀请
        that.send('ready', my.info);
    },
    /** 开始连接, 发出链接邀请 */
    startPeerConnection: function() {
        var that = this;
        // if (!my.isMediaReady) {
        //     console.log('连接没有准备好，等待中...');
        //     return that.startPeerConnection()
        // }

        console.log('开始连接, 发出链接邀请');
        //创建数据流信道, 不能一开始就创建，这样有问题, 而且顺序必须在createOffer之前
        my.dataChannel = my.rtcConnection.createDataChannel("sendDataChannel", { reliable: false });
        that.onDataChannel();

        let config = {
            offerToReceiveAudio: 1,
            offerToReceiveVideo: 1
        };
        my.rtcConnection.createOffer(config).then(function(_offer) {
            console.log("create offer success", _offer);
            console.log("setLocalDescription")
            return my.rtcConnection.setLocalDescription(_offer).then(function() {
                console.log("after setLocalDescription, rtcConnection.localDescription:", my.rtcConnection.localDescription)
                that.send('offer', _offer);
            })
        }).catch((error) => {
            Mt.alert({
                title: "An error on startPeerConnection:" + error,
                confirmBtnMsg: '好哒'
            });
        })
    },
    /** 消息接收处理 */
    onDataChannel: function() {
        var that = this;
        my.dataChannel.onopen = function() {
            console.log('dataChannel opened, ready now');
        };
        my.dataChannel.onerror = function(error) {
            console.log("Error:", error);
        };
        my.dataChannel.onmessage = function(data) {
            console.log(data);
            that.showMsg(data.data);
        };
    },
    /** 将对方加入自己的候选者中 */
    onNewPeer: function(data) {
        var candidate = data.data;
        my.rtcConnection.addIceCandidate(new RTCIceCandidate(candidate));

        //增加一个元素
        // my.connectors = document.createElement('video');
        // $('body').append(video);
    },
    /** 接收链接邀请，发出响应 */
    onOffer: function(data) {
        var that = this;
        var offer = data.data;
        my.connectors[data.user.id] = data.user.name;
        console.log("on remote offer", offer);
        console.log('setRemoteDescription offer')
        my.rtcConnection.setRemoteDescription(offer).then(() => {

            // let stream = my.localStream.stream
            // console.log('on offer ---> attach rtc stream:', stream);
            // my.rtcConnection.addStream(stream);

            return my.rtcConnection.createAnswer().then((_answer) => {
                console.log('create answer:', _answer)
                console.log('setLocalDescription answer')
                return my.rtcConnection.setLocalDescription(_answer).then(() => {
                    console.log('send answer')
                    that.send('answer', _answer);
                })
            })
        }).catch((error) => {
            console.log('onOffer error:', error)
        })
    },
    /** 接收响应，设置远程的peer session */
    onAnswer: function(data) {
        var answer = data.data;
        console.log('on remote answer', answer)
        console.log('setRemoteDescription answer')
        my.rtcConnection.setRemoteDescription(answer).catch(function(e) {
            console.error(e);
        });
        // my.rtcConnection.setRemoteDescription(new RTCSessionDescription(answer));
    },
    /** 对方离开，断开链接 */
    onLeave: function(user) {
        delete my.connectors[user.id];
        if (!my.rtcConnection) return
        console.log('sb leave, close rtcConnection-->', user)
        my.rtcConnection.close();
        // my.rtcConnection.onicecandidate = null;
        // my.rtcConnection.onaddstream = null;
        this.setupPeerConnection();
    },
    err: function(e) {
        console.log(e);
    },

    //显示聊天信息
    showMsg: function(data, isSelf) {
        var className = isSelf ? "right" : "left";

        // console.log('msg from :' + JSON.stringify(user));
        var message = "<li class='" + className + " item'><span class='msg'>" + data + "</span></li>";

        $('.J-msg').append(message);
        //append dom as first child
        // $('.J-msg').prepend(message);
        // 滚动条保持最下方
        $('.J-msg').scrollTop($('.J-msg')[0].scrollHeight);

    }

}

rtc.init();

function hasRTCPeerConnection() {
    window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    window.RTCSessionDescription = window.RTCSessionDescription || window.webkitRTCSessionDescription || window.mozRTCSessionDescription;
    window.RTCIceCandidate = window.RTCIceCandidate || window.webkitRTCIceCandidate || window.mozRTCIceCandidate;
    return !!window.RTCPeerConnection;
}
function showLocal() {
    var video = document.createElement('video')
    video.srcObject = localVideo
    video.play()
    document.body.appendChild(video)
}
function showRemote() {
    var video = document.createElement('video')
    video.srcObject = remoteVideo
    video.play()
    document.body.appendChild(video)
}
