/**
 * 在线KTV
 * created by lduoduo
 * 依赖: webAudio.js
 */

// 引入样式文件
import './ktv.scss';

// 引入资源
require('../../media/cs1.mp3')
require('../../media/cs2.mp3')
require('../../media/cs3.mp3')
require('../../media/cs4.mp3')
require('../../media/cs5.mp3')
require('../../media/cs6.mp3')
require('../../media/cs7.mp3')
require('../../media/cs8.mp3')
require('../../media/cs9.mp3')
require('../../media/cs10.mp3')

// 音视频画面容器
let $localVideo = document.querySelector('.J-local-video');
let $remoteVideo = document.querySelector('.J-remote-video');

let serverWs = MY.environment === 'dev' ? `${window.location.hostname}:${MY.wsPort}` : window.location.hostname
let serverStatic = MY.frontUrl


window.home = {
    // 本地流
    local: {
        video: null,
        audio: null,
        stream: null,
        // 混合伴奏的音频
        remixAudio: null,
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

        StreamOption.init();
        this.initEvent();
        this.lazy()
    },
    initBgMusic(file) {
        if(true) return 

        if (!window.mv) {
            window.mv = new MusicVisualizer();
            mv.ini({ canvas: $("#canvas")[0], context: window, isMobile: /(Android|IOS)/gi.test(platform.os.family) });
            mv.on('end', this.onMusicEnd.bind(this))
        }
        let option = { file }, url

        if (!file) {
            let index = Math.floor(Math.random() * 10) + 1
            option.url = `${serverStatic}media/cs${index}.mp3`
        }

        mv.play(option).then(data => {
            $('.J-rtc-file-name').html(data)
            console.log(data)
        }).catch(e => {
            console.log('music play error')
            this.initBgMusic();
        });
        // mv.play({ url: `${serverStatic}media/data.mp3` });

    },

    // 音乐播放完毕的监听
    onMusicEnd() {
        console.log('music end')
        // 如果当前没有在播，则换
        if (mv.source.curr === mv.source.newUrl) {
            this.initBgMusic();
        }
    },
    initEvent() {
        let that = this
        $('body').on('click', '.J-start', this.startRTC.bind(this))
        $('body').on('click', '.J-toggleMic', this.toggleMic.bind(this))
        $('body').on('click', '.J-toggleCam', this.toggleCam.bind(this))
        $('body').on('click', '.J-toggleScreenShare', this.toggleScreenShare.bind(this))
        $('body').on('click', '.J-toggleAudio', this.toggleAudio.bind(this))
        $('body').on('click', '.J-switchCamera', this.switchCamera.bind(this))

        // 播放背景音乐
        $('body').on('click', '.J-play', this.togglePlay.bind(this))
        $('body').on('click', '.J-tip-check', this.toggleDebugStatus.bind(this))
        $('body').on('click', '.J-showBrowser', this.showBroswer.bind(this))

        // 选择伴奏
        $('body').on('click', '.J-rtc-file', function () {
            $('#fileInput').click()
        })
        $('body').on('change', '#fileInput', this.selectedFile.bind(this))

        // 录制开关
        $('body').on('click', '.J-toggleRecord', this.toggleRecord.bind(this))

        // 音量控制
        $('body').on('change', '.J-volume-range', this.volumeRange.bind(this))

        window.addEventListener('beforeunload', this.destroy.bind(this));
    },
    // 延迟加载
    lazy() {
        lazyLoad(`${serverStatic}lib/musicPlug.js`, function () {
            this.initBgMusic();
            console.log('musicPlug done')
        }.bind(this))
        lazyLoad(`${serverStatic}lib/webAudio.js`, function () {
            console.log('webAudio done')
        }.bind(this))
        lazyLoad(`${serverStatic}lib/mediaRecord.js`, function () {
            console.log('mediaRecord done')
        }.bind(this))
    },
    // 注销RTC
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
    // 开关debug模式
    toggleDebugStatus() {
        $('.J-tip-check').toggleClass('active')
        this.isDebugEnable = $('.J-tip-check').hasClass('active');
    },
    // 开关播放音乐
    togglePlay() {
        $('.J-play').toggleClass('active')
        if ($('.J-play').hasClass('active')) {
            mv.resume()
        } else {
            mv.pause()
        }
    },
    // 音量控制
    volumeRange(e) {
        let dom = $(e.target)
        let type = dom.data('type')
        let volume = dom.val()

        // 改背景
        if (type === 'muisc') {
            mv.changeVolumn(volume);
        }
        // 改人声
        if (type === 'voice') {
            StreamOption.changeVolumn(volume);
        }
    },
    // 开关本地音频
    toggleAudio(e) {
        let dom = $('.J-toggleAudio')
        dom.toggleClass('active')
        if (dom.hasClass('active')) {
            StreamOption.startAudio()
            // dom.html('关试音(默认关)')
        } else {
            StreamOption.stopAudio()
            // dom.html('开试音(默认关)')
        }
    },
    // 开关录制功能
    toggleRecord() {
        let dom = $('.J-toggleRecord')

        if (!dom.hasClass('active')) {
            // 开始录制
            this.startRecord().then(() => {
                dom.toggleClass('active', true)
            }).catch(err => {
                Mt.alert({
                    title: '录制错误',
                    msg: err,
                    confirmBtnMsg: '好哒'
                })
            })
        } else {
            // 开始录制
            this.stopRecord().then(() => {
                dom.toggleClass('active', false)
            }).catch(err => {
                Mt.alert({
                    title: '停止录制错误',
                    msg: err,
                    confirmBtnMsg: '好哒'
                })
            })
        }
    },
    // 开关麦克风
    toggleMic(e) {
        let dom = $('.J-toggleMic')
        if (!dom.hasClass('active')) {

            StreamOption.startDeviceAudio().then((obj) => {
                if (obj.video) this.local.video = obj.video
                if (obj.audio) this.local.audio = obj.audio
                this.updateRtcStream()
                dom.toggleClass('active', true)
                $('.J-toggleAudio').toggleClass('hide', false)
            }).catch(err => {
                console.error(err)
                let error = err.constructor === String ? err : typeof err === 'object' ? err.stack || err.message : JSON.stringify(err)
                Mt.alert({
                    title: 'error',
                    msg: error,
                    confirmBtnMsg: '好哒'
                })
                dom.toggleClass('active', false)
                $('.J-toggleAudio').toggleClass('hide', true)
            })

        } else {
            StreamOption.stopDeviceAudio()
            this.local.audio = new MediaStream()
            this.updateRtcStream()
            dom.toggleClass('active', false)
            $('.J-toggleAudio').toggleClass('hide', true)
        }
    },
    // 开关摄像头
    toggleCam(e) {
        let dom = $('.J-toggleCam')
        if (!dom.hasClass('active')) {
            StreamOption.startDeviceVideo().then((obj) => {
                if (obj.video) this.local.video = obj.video
                if (obj.audio) this.local.audio = obj.audio
                this.startLocalVideoStream()
                this.updateRtcStream()
                dom.toggleClass('active', true)
                $('.J-switchCamera').toggleClass('active', StreamOption.devices.video.length > 1)
            }).catch(err => {
                console.error(err)
                let error = err.constructor === String ? err : typeof err === 'object' ? err.stack || err.message : JSON.stringify(err)
                Mt.alert({
                    title: 'error',
                    msg: error,
                    confirmBtnMsg: '好哒'
                })
                dom.toggleClass('active', false)
                $('.J-switchCamera').toggleClass('active', false)
            })
        } else {
            this.stopLocalVideoStream()
            StreamOption.stopDeviceVideo()
            this.local.video = new MediaStream()
            this.updateRtcStream()
            dom.toggleClass('active', false)
            $('.J-switchCamera').toggleClass('active', false)
        }
    },
    // 开关桌面共享
    toggleScreenShare(e) {
        let dom = $('.J-toggleScreenShare')

        let fn = !dom.hasClass('active') ? 'startScreenShare' : 'stopScreenShare'

        StreamOption[fn]('screen').then((obj) => {
            if (obj.video) this.local.video = obj.video
            if (obj.audio) this.local.audio = obj.audio
            this.startLocalVideoStream()
            this.updateRtcStream()
            dom.toggleClass('active', true)
        }).catch(err => {
            console.error(err)
            let error = err.constructor === String ? err : typeof err === 'object' ? err.stack || err.message : JSON.stringify(err)
            Mt.alert({
                title: 'error',
                msg: error,
                confirmBtnMsg: '好哒'
            })
            dom.toggleClass('active', false)
        })
    },
    // 开关debug模式
    toggleDebugStatus() {
        $('.J-tip-check').toggleClass('active')
        this.isDebugEnable = $('.J-tip-check').hasClass('active');
    },
    // 切换前后摄像头
    switchCamera() {
        if (!$('.J-toggleCam').hasClass('active')) {
            return Mt.alert({
                title: 'error',
                msg: '请先打开摄像头',
                confirmBtnMsg: '好哒'
            })
        }
        StreamOption.switchCamera().then((obj) => {
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
        $('.J-play').toggleClass('video', true)
        $localVideo.classList.add('active')
        // 开启画面
        $localVideo.autoplay = true;
        // 兼容
        if ($localVideo.srcObject === undefined) {
            let url = URL.createObjectURL(this.local.video)
            $localVideo.src = url
        } else {
            $localVideo.srcObject = this.local.video;
        }

        setTimeout(() => {
            // 调整宽高
            let r1 = document.body.clientWidth / document.body.clientHeight
            let r2 = $localVideo.videoWidth / $localVideo.videoHeight
            if (r2 > r1) {
                // 高度填不满, 填充高度，宽度自适应
                $localVideo.style.height = '100%'
                $localVideo.style.width = 'auto'
            } else {
                $localVideo.style.height = 'auto'
                $localVideo.style.width = '100%'
            }
        }, 100)

    },
    // 停止本地视频流外显
    stopLocalVideoStream() {
        $('.J-play').toggleClass('video', false)
        $localVideo.classList.remove('active')

        if ($localVideo.srcObject === undefined) {
            $localVideo.src = null
        } else {
            $localVideo.srcObject = null;
        }
    },
    updateLocalStream() {
        let that = this;
        this.local.stream = new MediaStream();

        let videoTrack = this.local.video && this.local.video.getVideoTracks()[0]
        let audioTrack = null

        // 混合音频轨道先
        if (!this.remixWebAudio) {
            return new webAudio([this.local.audio]).then((obj) => {
                this.remixWebAudio = obj
                this.remixAudio = obj.outputStream
                audioTrack = this.remixAudio.getAudioTracks()[0]
                next()
                return Promise.resolve()
            }).catch(err => {
                console.error(err)
            })
        }

        audioTrack = this.remixAudio.getAudioTracks()[0]

        next()

        return Promise.resolve()

        function next() {
            // 添加视频
            videoTrack && that.local.stream.addTrack(videoTrack)

            //添加音频
            audioTrack && that.local.stream.addTrack(audioTrack)
        }
    },
    // 更新RTC流
    updateRtcStream() {
        if (!this.rtc || !this.rtc.inited) return

        this.updateLocalStream();

        window.myLocalStream = this.local.stream;

        this.rtc.updateStream(this.local.stream)
    },
    // 选择伴奏
    selectedFile() {
        let fileInput = document.querySelector('input#fileInput')
        let file = fileInput.files[0]
        if (!file) return
        this.initBgMusic(file)
    },
    // 开始录制
    startRecord() {
        if (this.recorder) return Promise.reject('当前正在录制中')

        if (!this.local.stream) {
            return this.updateLocalStream().then(() => {
                if (!this.local.stream) {
                    return Promise.reject('当前没有音视频数据，无法进行录制')
                }
                this.startRecord()
            })
        }

        let streams = this.local.stream

        return new MR(streams)
            .then(obj => {
                this.recorder = obj
                return Promise.resolve()
            })
            .catch(err => {
                return Promise.reject(err)
            })
    },
    // 停止录制
    stopRecord() {
        let recorder = this.recorder
        if (!recorder) return Promise.reject('请先开启音视频录制')

        return recorder.stop()
            .then(obj => {
                this.recorder = null
                return Promise.resolve()
            })
            .catch(err => {
                return Promise.reject(err)
            })
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

        let stream = this.localStream

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
    rtcStop() {
        Mt.alert({
            title: 'webrtc服务器连接失败',
            msg: '服务连接已断开，请稍后重新加入房间',
            confirmBtnMsg: '好哒'
        });
        console.log('rtc 服务连接已断开，请稍后重新加入房间')
    },
    // 对方离开
    rtcLeave(uid) {
        Mt.alert({
            title: '对方已断开连接',
            confirmBtnMsg: '好哒'
        });
        console.log(`远程用户已断开: `, uid)
    },
    test(){
        var a = document.createElement('audio')
        a.controls = true
        a.srcObject = mv.destination.stream;
        document.body.appendChild(a)
    }
}

// 与设备相关
let StreamOption = {
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
        if (this.devices.audio.length === 0) {
            return Promise.reject('无法开启麦克风, 当前没有可用设备')
        }

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
        if (this.devices.video.length === 0) {
            return Promise.reject('无法开启摄像头, 当前没有可用设备')
        }

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

            mms.getTracks().forEach(function (track) {
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
        if (!this.devices.video || this.devices.video.length <= 1) return Promise.reject('无法切换摄像头, 当前没有2个以上摄像头')

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
        if (!/Firefox/.test(this.browser)) return Promise.reject('无法共享桌面, 请使用最新firefox浏览器')
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

        if (this.local.webAudio) {
            this.local.webAudio.updateStream(this.local.audioStream)
            return Promise.resolve({ audio: this.local.audio, video: this.local.video })
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
    },
    // 改变音量
    changeVolumn(volume) {
        if (this.local.webAudio) {
            this.local.webAudio.setGain(volume)
        }
    }
}

home.init()