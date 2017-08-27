/**
 * 在线KTV
 * created by lduoduo
 * 依赖: webAudio.js
 */

// 引入样式文件
import './ktv.scss';
import StreamOption from 'lib/stream'

// 引入资源, 背景音乐
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
require('../../media/cs11.mp3')
require('../../media/cs12.mp3')
require('../../media/cs13.mp3')
require('../../media/cs14.mp3')
require('../../media/cs15.mp3')
require('../../media/cs16.mp3')
require('../../media/cs17.mp3')
require('../../media/cs18.mp3')
require('../../media/cs19.mp3')
require('../../media/cs20.mp3')

//test
require('../../media/data.mp3')
require('../../media/secret.mp3')
require('../../media/welcome.m4a')
require('../../media/welcome2.m4a')


// 引入资源, 效果器
require('../../media/e_echo.wav')
require('../../media/e_muffler.wav')
require('../../media/e_radio.wav')
require('../../media/e_spring.wav')
require('../../media/e_telephone.wav')

window.mixer = require('../../module/tyt/tyt.js')
// mixer.open()

let musicList = [
    // `${MY.frontUrl}media/cs1.mp3`,
    // `${MY.frontUrl}media/cs2.mp3`,
    // `${MY.frontUrl}media/cs3.mp3`,
    // `${MY.frontUrl}media/cs4.mp3`,
    // `${MY.frontUrl}media/cs5.mp3`,
    // `${MY.frontUrl}media/cs6.mp3`,
    // `${MY.frontUrl}media/cs7.mp3`,
    // `${MY.frontUrl}media/cs8.mp3`,
    // `${MY.frontUrl}media/cs9.mp3`,
    // `${MY.frontUrl}media/cs10.mp3`,
    // `${MY.frontUrl}media/cs11.mp3`,
    // `${MY.frontUrl}media/cs12.mp3`,
    // `${MY.frontUrl}media/cs13.mp3`,
    // `${MY.frontUrl}media/cs14.mp3`,
    // `${MY.frontUrl}media/cs15.mp3`,
    // `${MY.frontUrl}media/cs16.mp3`,
    // `${MY.frontUrl}media/cs17.mp3`,
    // `${MY.frontUrl}media/cs18.mp3`,
    // `${MY.frontUrl}media/cs19.mp3`,
    // `${MY.frontUrl}media/cs20.mp3`
    `${MY.frontUrl}media/welcome.m4a`,
    `${MY.frontUrl}media/welcome2.m4a`
]

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

        this.initEvent();
        this.lazy()

    },
    // 延迟加载
    lazy() {

        lazyLoad(`${serverStatic}lib/webAudio.js`).then(() => {
            console.log('webAudio done')
            return this.initWebAudio()
        }).then(() => {
            StreamOption.init(this.webAudio);
            this.playMusic().then(() => {
                // 加载效果器
                this.loadEffect();
                // 第一次缓存
                this.webAudio.loadMusicList({ urls: musicList })
            })
        }).catch(err => {
            console.error(err)
            alert(JSON.stringify(err))
        })

        lazyLoad(`${serverStatic}lib/mediaRecord.js`).then(() => {
            console.log('mediaRecord done')
        })
    },
    // 初始化webAudio环境,该环境融合背景音乐和voice人声
    initWebAudio() {
        let that = this

        return new WebAudio().then((obj) => {
            this.webAudio = obj
            // 初始化音频
            this.local.audio = this.webAudio.streamDestination.stream
            // console.log('webAudio outputStream', this.local.audio, this.local.audio.getAudioTracks())
            this.initWebAudioEvent()
            this.initTyt()
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
    // 初始化musicAudio事件
    initWebAudioEvent() {
        let webAudio = this.webAudio
        webAudio.on('end', this.onMusicEnd.bind(this))
        // webAudio.on('outputStream', this.onMusicStream.bind(this))
        webAudio.on('playlist', function (obj) {
            // console.log('playlist',obj)
            this.playlist = obj
        }.bind(this))
    },
    // 播放远程背景音乐
    playMusic(file) {
        let option = { file }, name
        let webAudio = this.webAudio

        console.log('play list', this.playlist)
        if (this.playlist) {
            let index = Math.floor(Math.random() * this.playlist.length)
            option.name = this.playlist[index]
        }

        if (!file && !this.playlist) {
            let index = Math.floor(Math.random() * (musicList.length - 1)) + 1
            option.url = musicList[index]
            //test
            option.url = `${MY.frontUrl}media/secret.mp3`
        }

        return webAudio.play(option).then(data => {
            $('.J-rtc-file-name').html(data)
            // console.log(data)
            return Promise.resolve()
        }).catch(err => {
            console.log('music play error', err)
            Mt.alert({
                title: 'WebAudio播放失败',
                msg: JSON.stringify(err),
                html: true,
                confirmBtnMsg: '知道了'
            })
        });
    },
    // 初始化调音台
    initTyt(){
        mixer.init(this.webAudio)
    },
    // 加载效果器
    loadEffect() {
        this.webAudio.loadMusicList({
            urls: [
                `${MY.frontUrl}media/e_echo.wav`,
                `${MY.frontUrl}media/e_muffler.wav`,
                `${MY.frontUrl}media/e_radio.wav`,
                `${MY.frontUrl}media/e_spring.wav`,
                `${MY.frontUrl}media/e_telephone.wav`
            ],
            isAll: true
        }).then(obj => {
            this.effectlist = obj
            var html = ""
            obj.forEach((name, index) => {
                html += `<a class="btn btn-effect J-audio-effect" data-type="${name}">效果${index + 1}</a>`
            })
            $('.J-effects').html(html)
            // console.log(obj)
        })
    },
    // 音乐输出流监听
    onMusicStream(stream) {
        console.log('outputStream changed', stream, stream.getTracks())
        stream.type = 'music'
        // this.webAudio.updateStream({ type: 'music', stream })
        // if (!this.testAudioNode) {
        //     home.test()
        //     return
        // }
        // this.testAudioNode.srcObject = stream
    },
    // 音乐播放完毕的监听
    onMusicEnd() {
        console.log('music end')
        // 如果当前没有在播，则换
        this.playMusic();
    },
    // 事件注册
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
        // $('body').on('click', '.J-showBrowser', this.showBroswer.bind(this))

        $('body').on('click', '.J-showBrowser', this.toggleTYT.bind(this))


        // 选择伴奏
        $('body').on('click', '.J-rtc-file', function () {
            $('#fileInput').click()
        })
        $('body').on('change', '#fileInput', this.selectedFile.bind(this))

        // 录制开关
        $('body').on('click', '.J-toggleRecord', this.toggleRecord.bind(this))

        // 音量控制
        $('body').on('change', '.J-volume-range', this.volumeRange.bind(this))

        // 效果选择
        $('body').on('click', '.J-audio-effect', this.audioEffect.bind(this))

        window.addEventListener('beforeunload', this.destroy.bind(this));
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
    // 开关调音台
    toggleTYT() {
        mixer.open()
    },
    // 开关播放音乐
    togglePlay() {
        $('.J-play').toggleClass('active')
        if ($('.J-play').hasClass('active')) {
            this.webAudio.resume('music')
        } else {
            this.webAudio.pause('music')
        }
    },
    // 音量控制
    volumeRange(e) {
        let dom = $(e.target)
        let type = dom.data('type')
        let volume = dom.val()

        // 改背景
        if (type === 'muisc') {
            this.webAudio.setGain(volume, 'music');
        }
        // 改人声
        if (type === 'voice') {
            this.webAudio.setGain(volume);
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
                StreamOption.stopDeviceAudio()
                dom.toggleClass('active', false)
                $('.J-toggleAudio').toggleClass('hide', true)
            })

        } else {
            StreamOption.stopDeviceAudio()
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
                this.stopLocalVideoStream()
                StreamOption.stopDeviceVideo()
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
        let audioTrack = this.local.audio && this.local.audio.getAudioTracks()[0]

        // 混合音频轨道先
        // if (!this.remixWebAudio) {
        //     return new webAudio({ stream: [this.local.audio] }).then((obj) => {
        //         this.remixWebAudio = obj
        //         this.remixAudio = obj.outputStream
        //         audioTrack = this.remixAudio.getAudioTracks()[0]
        //         next()
        //         return Promise.resolve()
        //     }).catch(err => {
        //         console.error(err)
        //     })
        // }

        // audioTrack = this.remixAudio.getAudioTracks()[0]

        // 添加视频
        videoTrack && that.local.stream.addTrack(videoTrack)

        //添加音频
        audioTrack && that.local.stream.addTrack(audioTrack)

        return Promise.resolve()

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
        this.playMusic(file)
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
    // 选择效果
    audioEffect(e) {
        let dom = $(e.target)
        let type = dom.data('type')
        StreamOption.audioEffect(type)
        dom.addClass('active').siblings().removeClass('active')
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

        this.updateLocalStream()
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
        // rtc.on('receiveBlob', this.receiveBlob.bind(this))
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
        window.myRemoteStream = stream
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
    }
}

home.init()