/**
 * 实时音视频通讯
 * created by lduoduo
 * 依赖: webAudio.js
 */

// 引入样式文件
import './chat.scss';


// 音视频画面容器
let $localVideo = document.querySelector('.J-local-video');
let $remoteVideo = document.querySelector('.J-remote-video');

let serverIp = MY.environment === 'dev' ? window.location.hostname + ':8099' : window.location.hostname

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
        stream.init();
        this.initEvent();

        if (/Firefox/.test(platform.name)) $('.J-toggleScreenShare').toggleClass('hide', false)
    },
    initEvent() {
        let that = this
        $('body').on('click', '.J-start', this.startRTC.bind(this))
        $('body').on('click', '.J-toggleMic', this.toggleMic.bind(this))
        $('body').on('click', '.J-toggleCam', this.toggleCam.bind(this))
        $('body').on('click', '.J-toggleScreenShare', this.toggleScreenShare.bind(this))
        $('body').on('click', '.J-toggleAudio', this.toggleAudio.bind(this))
        $('body').on('click', '.J-switchCamera', this.switchCamera.bind(this))
        $('body').on('click', '.J-remote-video', function() {
            let local = $localVideo.srcObject
            let remote = $remoteVideo.srcObject
            $localVideo.srcObject = remote
            $remoteVideo.srcObject = local
        })
        $('body').on('click', '.J-local-video', function() {
            $('.rtc-video').toggleClass('full-screen')
        })
        $('body').on('click', '.J-tip-check', this.toggleDebugStatus.bind(this))
        $('body').on('click', '.J-toggleCanvas', this.toggleCanvas.bind(this))

        window.addEventListener('beforeunload', this.destroy.bind(this));
    },
    destroy() {
        if (!this.rtc) return
        this.rtc.stop()
    },
    controlMedia(e) {
        if (!this.local.stream) {
            this.initDevice().then(() => {
                $(e.target).text('关闭音视频')
            })
            return
        }
        this.stopDevice().then(() => {
            this.stopLocalStream();
            $(e.target).text('开启音视频')
        })
    },
    // 开关本地音频
    toggleAudio(e) {
        let dom = $('.J-toggleAudio')
        dom.toggleClass('active')
        if (dom.hasClass('active')) {
            stream.startAudio()
            dom.html('关闭本地音频(默认不开)')
        } else {
            stream.stopAudio()
            dom.html('播放本地音频(默认不开)')
        }
    },
    // 开关麦克风
    toggleMic(e) {
        let dom = $(e.target)
        dom.toggleClass('active')
        if (dom.hasClass('active')) {
            stream.startDeviceAudio().then((obj) => {
                if (obj.video) this.local.video = obj.video
                if (obj.audio) this.local.audio = obj.audio
                this.updateRtcStream()
                dom.html('关闭麦克风')
                $('.J-toggleAudio').toggleClass('hide', false)
            }).catch(err => {
                console.error(err)
                let error = err.constructor === String ? err : /Error/gi.test(err.constructor) ? err.stack || err.message : JSON.stringify(err)
                Mt.alert({
                    title: 'error',
                    msg: error,
                    confirmBtnMsg: '好哒'
                })
                $('.J-toggleAudio').toggleClass('hide', true)
            })

        } else {
            stream.stopDeviceAudio()
            this.updateRtcStream()
            dom.html('开启麦克风')
            $('.J-toggleAudio').toggleClass('hide', true)
        }
    },
    // 开关摄像头
    toggleCam(e) {
        let dom = $(e.target)
        dom.toggleClass('active')
        if (dom.hasClass('active')) {
            stream.startDeviceVideo().then((obj) => {
                if (obj.video) this.local.video = obj.video
                if (obj.audio) this.local.audio = obj.audio
                this.startLocalVideoStream()
                this.updateRtcStream()
                dom.html('关闭摄像头')
                $('.J-switchCamera').toggleClass('hide', false)
            }).catch(err => {
                console.error(err)
                let error = err.constructor === String ? err : /Error/gi.test(err.constructor) ? err.stack || err.message : JSON.stringify(err)
                Mt.alert({
                    title: 'error',
                    msg: error,
                    confirmBtnMsg: '好哒'
                })
                $('.J-switchCamera').toggleClass('hide', true)
            })

        } else {
            stream.stopDeviceVideo()
            this.updateRtcStream()
            dom.html('开启摄像头')
            $('.J-switchCamera').toggleClass('hide', true)
        }
    },
    // 开关桌面共享
    toggleScreenShare(e) {
        if (!/Firefox/.test(platform.name)) return
        let dom = $(e.target)
        dom.toggleClass('active')
        let fn = dom.hasClass('active') ? 'startScreenShare' : 'stopScreenShare'

        stream[fn]('screen').then((obj) => {
            if (obj.video) this.local.video = obj.video
            if (obj.audio) this.local.audio = obj.audio
            this.startLocalVideoStream()
            this.updateRtcStream()
            dom.html(fn === 'startScreenShare' ? '关闭桌面共享' : '开启桌面共享')
        }).catch(err => {
            console.error(err)
            let error = err.constructor === String ? err : /Error/gi.test(err.constructor) ? err.stack || err.message : JSON.stringify(err)
            Mt.alert({
                title: 'error',
                msg: error,
                confirmBtnMsg: '好哒'
            })
            dom.html(fn === 'startScreenShare' ? '开启桌面共享' : '关闭桌面共享')
        })
    },
    // 开关debug模式
    toggleDebugStatus() {
        $('.J-tip-check').toggleClass('active')
        this.isDebugEnable = $('.J-tip-check').hasClass('active');
    },
    // 切换前后摄像头
    switchCamera() {
        stream.switchCamera().then((obj) => {
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
            let url = URL.createObjectURL(this.local.video)
            $localVideo.src = url
        } else {
            $localVideo.srcObject = this.local.video;
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
        let audioTrack = this.local.audio && this.local.audio.getVideoTracks()[0]
        // 添加视频
        videoTrack && this.local.stream.addTrack(videoTrack)

        //添加音频
        audioTrack && this.local.stream.addTrack(audioTrack)

    },
    // 更新RTC流
    updateRtcStream() {
        if (!this.rtc || !this.rtc.inited) return

        this.updateLocalStream();

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
            canvas.toBlob(function(blob) {
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
        let {name, size, currentSize} = data
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

            img.onload = function() {
                canvas.width = img.width
                canvas.height = img.height
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
            }

            img.src = url;
        }

    },
    /**********************blob end**************************** */
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

        let stream = this.localStream

        let url = `wss://${serverIp}/rtcWs`;

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
        rtc.on('stop', this.stopRTC.bind(this))
        rtc.on('ready', this.rtcStatus.bind(this))
        rtc.on('receiveBlob', this.receiveBlob.bind(this))
    },
    rtcStatus(obj) {
        console.log(obj)
        let {status, error, url} = obj

        Mt.alert({
            title: status ? 'webrtc连接成功' : error,
            msg: url || '',
            confirmBtnMsg: '好哒',
            // timer: 1000
        });
    },
    // 接收到远程流，进行外显
    startRemoteStream(stream) {
        // console.log('remote stream:', stream);
        $remoteVideo.srcObject = stream;
        $remoteVideo.play();

        stream.onaddtrack = e => {
            console.log('on addTrack', e)
        }
        stream.onremovetrack = e => {
            console.log('on removeTrack', e)
        }
    },
    // 远程连接断开
    stopRTC(uid) {
        console.log(`远程rtc连接已断开,用户: `, uid)
    }
}


let stream = {
    browser: platform.name,
    isVideoEnable: false, //是否开启摄像头
    // 当前在使用摄像头的位置, 默认第一个
    deviceIndex: 0,
    // 本地摄像头个数
    devices: [],
    local: {
        // webAudio
        webAudio: null,
        video: null,
        // webAudio处理后的音频流
        audio: null,
        // 原生音频流
        audioStream: null
    },
    init() {
        this.getDevices()
    },
    /**
     * 获取设备列表
     * 
     * @returns obj 设备列表对象
     */
    getDevices() {
        // 文档见: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            // console.log("your browser not support this feature");
            return Promise.reject("your browser not support this feature, see https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices");
        }

        return navigator.mediaDevices.enumerateDevices().then((devices) => {
            let result = {
                video: [],
                audio: []
            };
            devices.forEach((device, index) => {
                if (device.kind === "videoinput") {
                    result.video.push({
                        deviceId: device.deviceId,
                        label: device.label ? device.label : "camera " + (result.video.length + 1)
                    });
                } else if (device.kind === "audioinput") {
                    result.audio.push({
                        deviceId: device.deviceId,
                        label: device.label
                    });
                }
            });
            this.devices = result;
            console.log(result);
            return Promise.resolve(result);
        })
    },
    // 开启麦克风
    startDeviceAudio(deviceId) {
        if (!deviceId) deviceId = this.devices.audio[0].deviceId

        return navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: deviceId
            }
        }).then((stream) => {
            this.local.audioStream = stream;
            return this.formatLocalStream()
        }).catch(err => {
            console.error(err)
            return Promise.reject(err)
        });
    },
    // 开启摄像头
    startDeviceVideo(deviceId) {
        this.isVideoEnable = true

        if (!deviceId) deviceId = this.devices.video[this.deviceIndex].deviceId
        return navigator.mediaDevices.getUserMedia({
            video: {
                deviceId: deviceId,
                width: { min: 640, ideal: 1080, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 },
                // frameRate: { min: 10, ideal: 15, max: 25 },
                frameRate: { max: 30 }
            },
            audio: false
        }).then((stream) => {
            this.local.video = stream;
            return this.formatLocalStream()
        }).catch(err => {
            console.error(err)
            return Promise.reject(err)
        });
    },
    // 关闭音视频
    stopDevice() {
        let stream = this.local.stream
        stream.getTracks().forEach(track => {
            track.stop()
            stream.removeTrack(track)
        })
        dropMS(this.local.stream)
        dropMS(this.local.video)
        this.local.audio && this.local.audio.destroy()

        function dropMS(mms) {
            if (!mms) return
            let tracks = mms.getTracks()
            if (!tracks || tracks.length === 0) return

            mms.getTracks().forEach(function(track) {
                track.stop()
                mms.removeTrack(track)
            })
        }
        this.local.stream = null
        this.local.video = null
        this.local.audio = null

        this.updateStream()

        // 隐藏按钮
        $('.J-enableAudio').toggleClass('hide', true)
        $('.J-switchCamera').toggleClass('hide', true)
        $('.J-enableAudio').html('播放本地音频(默认不开)')

        return Promise.resolve()
    },
    // 关闭麦克风
    stopDeviceAudio() {
        let stream = this.local.audioStream
        stream && stream.getTracks().forEach(track => {
            track.stop()
            stream.removeTrack(track)
        })
    },
    /**
     * 关闭摄像头
     * 
     * @param {any} isMannual 是否是手动关闭，默认是true: 手动
     */
    stopDeviceVideo(isMannual = true) {
        if (isMannual) this.isVideoEnable = false
        let stream = this.local.video
        stream && stream.getTracks().forEach(track => {
            track.stop()
            stream.removeTrack(track)
        })
    },
    // 切换摄像头
    switchCamera() {
        if (!this.devices.video || this.devices.video.length <= 1) return
        this.deviceIndex++;
        if (this.deviceIndex > this.devices.video.length - 1) {
            this.deviceIndex = 0;
        }
        let deviceId = this.devices.video[this.deviceIndex].deviceId

        this.stopDeviceVideo()
        return this.startDeviceVideo(deviceId)
    },
    // 开启桌面共享
    startScreenShare(type) {
        if (!/Firefox/.test(this.browser)) return
        if (this.local.video) {
            this.stopDeviceVideo(false)
        }

        let constraint = {
            audio: false,
            video: {
                mediaSource: type
            }
        }

        return navigator.mediaDevices.getUserMedia(constraint).then((stream) => {
            this.local.video = stream;
            return this.formatLocalStream()
        }).catch(err => {
            console.error(err)
            return Promise.reject(err)
        });
    },
    // 关闭桌面共享
    stopScreenShare() {
        this.stopDeviceVideo(false)
        if (this.isVideoEnable) {
            return this.startDeviceVideo()
        }
        return Promise.resolve({})
    },
    // 格式化本地流
    formatLocalStream() {
        let audio = this.local.audioStream && this.local.audioStream.getAudioTracks()
        let video = this.local.video && this.local.video.getVideoTracks()

        if (!audio && !video) {
            return Promise.reject('none tracks available')
        }

        if (!audio) {
            return Promise.resolve({ video: this.local.video })
        }

        // 格式化音频
        return new webAudio(this.local.audioStream).then((obj) => {
            this.local.webAudio = obj
            this.local.audio = obj.outputStream
            return Promise.resolve({ audio: this.local.audio, video: this.local.video })

        })
    },
    // 播放声音
    startAudio() {
        this.local.webAudio.play()
    },
    // 停止播放声音
    stopAudio() {
        this.local.webAudio.pause()
    }

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


