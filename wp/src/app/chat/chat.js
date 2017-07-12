/**
 * 实时音视频通讯
 * created by lduoduo
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
        audioStream: null,
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
    // 当前在使用摄像头的位置, 默认第一个
    deviceIndex: 0,
    // 本地摄像头个数
    devices: [],
    init() {
        this.initEvent();
    },
    initEvent() {
        let that = this
        $('body').on('click', '.J-start', this.startRTC.bind(this))
        $('body').on('click', '.J-startMedia', this.controlMedia.bind(this))
        $('body').on('click', '.J-enableAudio', this.controlAudio.bind(this))
        $('body').on('click', '.J-switchCamera', this.switchCamera.bind(this))
        $('body').on('click', '.J-remote-video', function () {
            let local = $localVideo.srcObject
            let remote = $remoteVideo.srcObject
            $localVideo.srcObject = remote
            $remoteVideo.srcObject = local
        })
        $('body').on('click', '.J-local-video', function () {
            $('.rtc-video').toggleClass('full-screen')
        })

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
        this.stopDevice()
        $(e.target).text('开启音视频')
    },
    controlAudio(e) {
        if (this.local.audio.playStatus()) {
            this.local.audio.pause()
            $('.J-enableAudio').html('播放本地音频(默认不开)')
            return
        }
        this.local.audio.play()
        $('.J-enableAudio').html('关闭本地音频(默认不开)')
    },
    // 切换前后摄像头
    switchCamera() {
        if (!this.devices || this.devices.length <= 1) return
        this.deviceIndex++;
        if (this.deviceIndex === this.devices.length - 1) {
            this.deviceIndex = 0;
        }

        this.stopDevice()
        this.getLocalVideoStream(this.devices.video[this.deviceIndex].deviceId).then(() => {
            if ($localVideo.srcObject === undefined) {
                let url = URL.createObjectURL(this.local.video)
                $localVideo.src = url
            } else {
                $localVideo.srcObject = this.local.video;
            }
            this.updateLocalStream();
            this.updateStream();
        }).catch(err => {
            Mt.alert({
                msg: JSON.stringify(err),
                confirmBtnMsg: '好哒'
            });
        })
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

        this.updateStream()

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

        // 隐藏按钮
        $('.J-enableAudio').toggleClass('hide', true)
        $('.J-switchCamera').toggleClass('hide', true)
        $('.J-enableAudio').html('播放本地音频(默认不开)')
    },
    /**
    * 开启音视频
    */
    initDevice() {
        return this.getDevices().then(function (devices) {
            devices = devices.video;
            return this.startLocalStream(devices[0].deviceId);
        }.bind(this)).catch(err => {
            let html = ""
            if (err.constructor === Error) {
                for (let i in err) {
                    html += err[i] + '<br>'
                }
            } else {
                html = err.stack || JSON.stringify(err)
            }
            Mt.alert({
                msg: html,
                html: true,
                confirmBtnMsg: '好哒'
            });
            return Promise.reject(err)
        });
    },
    /**
     * 获取设备列表
     * 
     * @returns obj 设备列表对象
     */
    getDevices() {
        let that = this;
        return new Promise(function (resolve, reject) {
            // 文档见: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                // console.log("your browser not support this feature");
                return reject("your browser not support this feature, see https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices");
            }
            navigator.mediaDevices.enumerateDevices().then(function (devices) {
                let result = {
                    video: [],
                    audio: []
                };
                devices.forEach(function (device, index) {
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
                that.devices = result;
                return resolve(result);
            }).catch(function (e) {
                return reject(e);
            });
        });
    },
    /**
     * 获取本地音视频流
     * 
     * @param {any} deviceId 
     * @returns promise
     */
    getLocalStream(deviceId) {
        let that = this;
        return new Promise(function (resolve, reject) {
            navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: deviceId,
                    width: { min: 640, ideal: 1080, max: 1920 },
                    height: { min: 480, ideal: 720, max: 1080 },
                    // frameRate: { min: 10, ideal: 15, max: 25 },
                    frameRate: { max: 30 }
                },
                audio: true
            }).then(function (stream) {
                that.local.stream = stream
                resolve(stream);
            }).catch(reject);
        });
    },
    // 获取本地视频流
    getLocalVideoStream(deviceId) {
        let that = this;
        return new Promise(function (resolve, reject) {
            navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: deviceId,
                    width: { min: 640, ideal: 1080, max: 1920 },
                    height: { min: 480, ideal: 720, max: 1080 },
                    // frameRate: { min: 10, ideal: 15, max: 25 },
                    frameRate: { max: 30 }
                },
                audio: false
            }).then(function (stream) {
                that.local.video = stream;
                resolve(stream);
            }).catch(reject);
        });
    },
    // 获取本地音频流
    getLocalAudioStream(deviceId) {
        let that = this;
        return new Promise(function (resolve, reject) {
            navigator.mediaDevices.getUserMedia({
                audio: true
            }).then(function (stream) {
                that.local.audioStream = stream;
                resolve(stream);
            }).catch(reject);
        });
    },
    // 格式化本地流
    formatLocalStream() {
        let audio = this.local.stream.getAudioTracks()
        let video = this.local.stream.getVideoTracks()
        // audio = audio && audio[0]
        // video = video && video[0]
        audio = this.local.audioStream = new MediaStream(audio)
        this.local.video = new MediaStream(video)

        // 开启画面
        $localVideo.autoplay = true;

        // 兼容
        if ($localVideo.srcObject === undefined) {
            let url = URL.createObjectURL(this.local.video)
            $localVideo.src = url
        } else {
            $localVideo.srcObject = this.local.video;
        }

        // 格式化音频
        new webAudio(audio).then((obj) => {

            // 赋值audio变量
            this.local.audio = obj

            // 开启按钮
            $('.J-enableAudio').toggleClass('hide', false)
            $('.J-switchCamera').toggleClass('hide', this.devices.video.length <= 1)

        }).catch(error => {
            Mt.alert({
                title: error,
                confirmBtnMsg: '好哒'
            })
        })

    },
    // 开始获取本地流
    startLocalStream(deviceId) {
        let that = this;
        return this.getLocalStream(deviceId).then((stream) => {
            that.local.stream = stream;

            that.formatLocalStream()

            that.updateStream(stream)
            return Promise.resolve()
        }).catch((e) => {
            // mylog("<font>can't get local camera, see console error info</font>", '', 'error');
            console && console.error && console.error(e);
            return Promise.reject(e)
        });
    },
    updateLocalStream() {
        this.local.stream = new MediaStream();

        let videoTrack = this.local.video && this.local.video.getVideoTracks()[0]
        let audioTrack = this.local.audioStream && this.local.audioStream.getVideoTracks()[0]
        // 添加视频
        videoTrack && this.local.stream.addTrack(videoTrack)

        //添加音频
        audioTrack && this.local.stream.addTrack(audioTrack)

    },
    // 
    updateStream() {
        window.myLocalStream = this.local.stream;
        // let blob = new Blob(stream, {
        //     type: 'image/jpeg'
        // });

        if (this.rtc && this.rtc.inited) {
            this.rtc.updateStream(this.local.stream)
        }
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

        // let host = 'ldodo.cc'
        // let host = window.location.hostname + ':8099'

        let url = `wss://${serverIp}/rtcWs/?roomId=${cname}`;

        let rtc = this.rtc = new rtcSDK();
        rtc.init({ url, stream }).then(obj => {
            console.log('支持的注册事件:', obj)
        })

        rtc.on('stream', this.startRemoteStream.bind(this))
        rtc.on('stop', this.stopRTC.bind(this))
        rtc.on('ready', this.rtcStatus.bind(this))
    },
    rtcStatus(obj) {
        console.log(obj)
        let {status, error, url} = obj

        Mt.alert({
            title: status ? 'webrtc连接成功' : error,
            msg: url || '',
            confirmBtnMsg: '好哒',
            timer: 1000
        });
    },
    // 接收到远程流，进行外显
    startRemoteStream(stream) {
        console.log('remote stream:', stream);
        $remoteVideo.srcObject = stream;
        $remoteVideo.play();
    },
    // 远程连接断开
    stopRTC(uid) {
        console.log(`远程rtc连接已断开,用户: `, uid)
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


