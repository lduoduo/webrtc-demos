/**
 * 实时音视频通讯
 * created by lduoduo
 * 依赖: webAudio.js
 */

// 引入样式文件
import './video.scss';
// import StreamOptions from 'lib/stream'

// 音视频画面容器
let $localVideo = document.querySelector('.J-local-video');
let $remoteVideo = document.querySelector('.J-remote-video');

let serverWs = MY.environment === 'dev' ? `${window.location.hostname}:${MY.wsPort}` : window.location.hostname
// let serverWs = 'ldodo.cc/rtcWs'

let serverStatic = MY.frontUrl


window.home = {
    // 本地流
    local: {
        video: null,
        audio: null,
        stream: null
    },
    // 显示远程的列表
    remoteVideo: {},
    // 远端buffer数据
    remote: {
        // test是channelId, 这里为了说明数据结构这么写
        test: {
            buffer: [],
            size: 0,
            receivedSize: 0
        }

    },
    // 是否开启debug弹框
    isDebugEnable: $('.J-tip-check').hasClass('active'),
    init() {
        this.initEvent();

        if (/Firefox/.test(platform.name)) $('.J-toggleScreenShare').toggleClass('hide', false)
    },
    // 延迟加载
    lazy() {
        lazyLoad(`${serverStatic}lib/stream.js`).then(() => {
            return lazyLoad(`${serverStatic}lib/webAudio.js`).then(() => {
                console.log('webAudio done')
                return this.initWebAudio()
            })
        }).then(() => {
            StreamOptions.init(this.webAudio);
            StreamOptions.stopAudio()
        }).catch(err => {
            console.error(err)
            alert(JSON.stringify(err))
        })

        lazyLoad(`${serverStatic}lib/mediaRecord.js`).then(() => {
            console.log('mediaRecord done')
        })
    },
    initEvent() {
        let that = this
        $('body').on('click', '.J-toggleRTC', this.toggleRTC.bind(this))
        $('body').on('click', '.J-toggleMedia', this.toggleMedia.bind(this))

        $('body').on('click', '.J-tip-check', this.toggleDebugStatus.bind(this))
        $('body').on('click', '.J-toggleCanvas', this.toggleCanvas.bind(this))
        $('body').on('click', '.J-showBroswer', this.showBroswer.bind(this))

        window.addEventListener('beforeunload', this.destroy.bind(this));
    },
    // 初始化webAudio环境,该环境融合背景音乐和voice人声
    initWebAudio() {
        let that = this

        return new WebAudio().then((obj) => {
            this.webAudio = obj
            // 初始化音频
            this.local.audio = this.webAudio.streamDestination.stream
            // console.log('webAudio outputStream', this.local.audio, this.local.audio.getAudioTracks())

            return Promise.resolve()
        }).catch(err => {
            console.error(err)
            Mt.alert({
                title: 'WebAudio播放环境启动失败',
                msg: err.constructor === String ? err : err.stack || err.message,
                confirmBtnMsg: '好哒'
            })
            return Promise.reject(err)
        })

    },
    destroy() {
        if (!this.rtc) return
        this.rtc.stop()
    },
    // 查看浏览器信息
    showBroswer() {
        //test
        Mt.alert({
            title: 'broswer info',
            msg: JSON.stringify(platform),
            confirmBtnMsg: '好哒'
        })
    },
    // 开关音视频
    toggleMedia(e) {
        let dom = $(e.target)
        dom.toggleClass('active')
        if (dom.hasClass('active')) {
            StreamOptions.startDevice().then((stream) => {
                this.local.stream = stream
                this.startLocalVideoStream()
                this.updateRtcStream()
                dom.html('关闭音视频')
            }).catch(err => {
                console.error(err)
                let error = err.constructor === String ? err : typeof err === 'object' ? err.stack || err.message : JSON.stringify(err)
                Mt.alert({
                    title: 'error',
                    msg: error,
                    confirmBtnMsg: '好哒'
                })
                $('.J-switchCamera').toggleClass('hide', true)
                this.stopLocalVideoStream()
                StreamOptions.stopDevice()
            })

        } else {
            this.stopLocalVideoStream()
            StreamOptions.stopDevice()
            this.local.video = new MediaStream()
            this.updateRtcStream()
            dom.html('开启音视频')
            $('.J-switchCamera').toggleClass('hide', true)
        }
    },
    // 开关debug模式
    toggleDebugStatus() {
        $('.J-tip-check').toggleClass('active')
        this.isDebugEnable = $('.J-tip-check').hasClass('active');
    },
    // 切换前后摄像头
    switchCamera() {
        StreamOptions.switchCamera().then((obj) => {
            if (obj.video) this.local.video = obj.video
            if (obj.audio) this.local.audio = obj.audio
            this.startLocalVideoStream()
            this.updateRtcStream()
        }).catch(err => {
            console.error(err)
            let error = err.constructor === String ? err : /Error/gi.test(err.constructor) ? err.stack : JSON.stringify(err)
            Mt.alert({
                title: 'error',
                msg: error,
                confirmBtnMsg: '好哒'
            })
        })
    },
    // 开启本地视频流外显
    startLocalVideoStream() {
        // 开启画面
        $localVideo.autoplay = true;
        // 兼容
        if ($localVideo.srcObject === undefined) {
            let url = URL.createObjectURL(this.local.stream)
            $localVideo.src = url
        } else {
            $localVideo.srcObject = this.local.stream;
        }
    },
    // 停止本地视频流外显
    stopLocalVideoStream() {
        if ($localVideo.srcObject === undefined) {
            $localVideo.src = null
        } else {
            $localVideo.srcObject = null;
        }
    },
    updateLocalStream() {
        this.local.stream = new MediaStream();

        let videoTrack = this.local.video && this.local.video.getVideoTracks()[0]
        let audioTrack = this.local.audio && this.local.audio.getAudioTracks()[0]
        // 添加视频
        videoTrack && this.local.stream.addTrack(videoTrack)

        //添加音频
        audioTrack && this.local.stream.addTrack(audioTrack)

    },
    // 更新RTC流
    updateRtcStream() {
        if (!this.rtc || !this.rtc.inited) return

        // this.updateLocalStream();

        window.myLocalStream = this.local.stream;

        this.rtc.updateStream(this.local.stream)
    },
    toggleCanvas() {
        $('.J-canvas').toggleClass('active')
        if ($('.J-canvas').has('active')) {
            this.sendBlobs();
            $('.J-canvas').html('关闭canvas')
        } else {
            this.stopBlobs();
            $('.J-canvas').html('测试canvas')
        }
    },
    /**********************blob start**************************** */
    stopBlobs() {
        if (this.canvasTimer) {
            // 销毁定时器
            clearInterval(this.canvasTimer)
            this.canvasTimer = null
            // 销毁通道
            this.canvasChannelId && this.rtc.closeChannel(this.canvasChannelId)
            this.canvasChannelId = null
        }
    },
    // blob入口
    sendBlobs() {
        let srcObj = $localVideo.srcObject
        let that = this

        let canvas = this.canvas

        if (!canvas) {
            canvas = this.canvas = document.createElement('canvas')
            canvas.width = 500;
            canvas.height = 400;
        }

        let ctx = canvas.getContext('2d')

        this.rtc.createChannel({
            label: 'canvas',
            channelStatus: 'long'
        }).then(cid => {
            // console.log(cid)
            if (!cid) return

            this.canvasChannelId = cid
            this.canvasTimer = setInterval(next.bind(this), 50)
        })

        function next() {
            // 先重绘
            ctx.drawImage($localVideo, 0, 0, 500, 400);
            canvas.toBlob(function (blob) {
                blob.name = 'canvas'
                // blob.type = 'blob'
                console.log('canvas data:', blob)
                that.sendBlob(that.canvasChannelId, blob)
            }, 'image/jpeg');
        }

    },
    // 单个blob发送
    sendBlob(cid, blob) {
        this.rtc.sendBlob(cid, blob)
    },
    // 接收blob状态回传
    receiveBlob(data) {
        // this.remoteData[data.name] = this.remoteData[data.name] || {}
        // this.remoteData[data.name].data = data
        let { name, size, currentSize } = data
        if (currentSize == size) {
            this.showRemoteBlob(data)
        }
    },
    // 外显blob
    showRemoteBlob(data) {
        let blobs = new window.Blob(data.buffer);
        data.buffer = [];

        // 如果是图片，进行canvas渲染
        if (/blob/.test(data.type)) {
            let canvas = this.canvas = document.querySelector('#canvas')
            let ctx = canvas.getContext('2d');

            let img = new Image();
            let url = URL.createObjectURL(blobs);

            img.onload = function () {
                canvas.width = img.width
                canvas.height = img.height
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
            }

            img.src = url;
        }

    },
    /**********************blob end**************************** */
    toggleRTC() {
        $('.J-toggleRTC').toggleClass('active')
        if ($('.J-toggleRTC').hasClass('active')) {
            this.startRTC()
            $('.J-toggleRTC').html('退出房间')
        } else {
            this.stopRTC()
            $('.J-toggleRTC').html('加入房间')
        }
    },
    stopRTC() {
        if (!this.rtc || !this.rtc.inited) return
        this.rtc.stop()
    },
    /** 
     * 开启rtc连接
     * 支持的事件注册列表
     * mediastream
     * stop
     */
    startRTC() {
        if (this.rtc && this.rtc.inited) return

        let cname = $('.J-channelName').val()

        if (!cname) {
            Mt.alert({
                title: '请先输入房间号',
                confirmBtnMsg: '好'
            });
            return
        }

        // this.updateLocalStream()
        let stream = this.local.stream

        let url = `wss://${serverWs}/rtcWs`;

        let rtc = this.rtc = new rtcSDK();
        rtc.init({ url, roomId: cname, stream, debug: this.isDebugEnable }).then(obj => {
            console.log('支持的注册事件:', obj)
        }).catch(err => {
            Mt.alert({
                title: 'webrtc连接失败',
                msg: JSON.stringify(err),
                confirmBtnMsg: '好哒'
            })
        })

        rtc.on('stream', this.startRemoteStream.bind(this))
        rtc.on('stop', this.rtcStop.bind(this))
        rtc.on('leave', this.rtcLeave.bind(this))
        rtc.on('ready', this.rtcReady.bind(this))
        rtc.on('connected', this.rtcConnected.bind(this))
        rtc.on('receiveBlob', this.receiveBlob.bind(this))
    },
    rtcReady(obj) {
        console.log(obj)
        let { status, error, url } = obj

        let option = {
            title: status ? 'webrtc服务器连接成功' : error,
            msg: url || '',
            confirmBtnMsg: '好哒'
        }
        if (status) option.timer = 1000
        Mt.alert(option);
    },
    rtcConnected() {
        Mt.alert({
            title: 'ice通信连接成功',
            msg: '可以开启音视频通话啦~',
            confirmBtnMsg: '好哒',
            timer: 1500
        });
    },
    // 接收到远程流，进行外显
    startRemoteStream(stream) {
        window.myRemoteStream = stream
        // console.log('remote stream:', stream);
        // 兼容
        if ($remoteVideo.srcObject === undefined) {
            let url = URL.createObjectURL(stream)
            $remoteVideo.src = url
        } else {
            $remoteVideo.srcObject = stream;
        }
        $remoteVideo.play();

        stream.onaddtrack = e => {
            console.log('on addTrack', e)
        }
        stream.onremovetrack = e => {
            console.log('on removeTrack', e)
        }
    },
    // 远程连接断开
    rtcStop() {
        Mt.alert({
            title: 'webrtc服务器连接失败',
            msg: '服务连接已断开，请稍后重新加入房间',
            confirmBtnMsg: '好哒',
            timer: 2000,
        });
        console.log('rtc 服务连接已断开，请稍后重新加入房间')
    },
    // 对方离开
    rtcLeave(uid) {
        Mt.alert({
            title: '对方已断开连接',
            confirmBtnMsg: '好哒',
            timer: 2000,
        });
        console.log(`远程用户已断开: `, uid)
    }
}

let StreamOptions = {
    stream: null,
    startDevice() {
        // safari
        let constrant = {
            video: true,
            audio: true
        }

        console.log('constrant', constrant)
        return navigator.mediaDevices.getUserMedia(constrant).then((stream) => {
            this.stream = stream
            return stream
        }).catch(err => {
            console.error(err)
            return Promise.reject(err)
        });
    },
    stopDevice() {
        let stream = this.stream
        stream && stream.getTracks().forEach(track => {
            track.stop()
            stream.removeTrack(track)
        })
    },
}


home.init();

/**
 * 测试步骤
 * 1. 打开页面，自动获取到本地媒体流并显示
 * 2. 手动跑这个方法，传入一个自定义的频道名字，必传!!!
 */
function start(cname) {
    home.startRTC(cname)
}


