/** 
 * 与设备相关的各种操作，包括流的获取与销毁 
 * 依赖： 
 *  - webAudio.js
 *    https://github.com/lduoduo/webrtc-demos/blob/master/wp/src/sdk/webAudio.js
 *  - platform.js
 *    https://github.com/lduoduo/webrtc-demos/blob/master/wp/src/lib/platform.js
 */

window.StreamOption = {
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
    init(webAudio) {
        this.webAudio = webAudio
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
            return this.formatLocalStream('audio')
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
        let constrant = {
            video: {
                deviceId: deviceId,
                width: { min: 640, ideal: 1080, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 },
                // frameRate: { min: 10, ideal: 15, max: 25 },
                frameRate: { max: 30 }
            },
            audio: false
        }

        // safari
        if(/Safari/gi.test(platform.name)){
            constrant = {
                video: true,
                audio: false
            }
        }

        console.log('constrant', constrant)
        return navigator.mediaDevices.getUserMedia(constrant).then((stream) => {
            this.local.video = stream;
            return this.formatLocalStream('video')
        }).catch(err => {
            console.error(err)
            return Promise.reject(err)
        });
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
            return this.formatLocalStream('video')
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
    // 格式化本地流, 音频轨道一直在, 不作更改
    formatLocalStream(type = 'video') {

        let audio = this.local.audioStream && this.local.audioStream.getAudioTracks()
        let video = this.local.video && this.local.video.getVideoTracks()

        if (!audio && !video) {
            return Promise.reject('none tracks available')
        }

        if (type === 'video' && video) {
            return Promise.resolve({ video: this.local.video })
        }

        if (type === 'audio') {
            audio && this.webAudio && this.webAudio.updateStream({ type: 'voice', stream: this.local.audioStream })
            return Promise.resolve({ audio: this.local.audio })
        }
    },
    // 播放声音
    startAudio() {
        // this.webAudio.play()
        this.webAudio.speakerOn()
    },
    // 停止播放声音
    stopAudio() {
        // this.webAudio.pause()
        this.webAudio.speakerOff()
    },
    // 改变音量
    changeVolumn(volume) {
        if (this.webAudio) {
            this.webAudio.setGain(volume)
        }
    },
    // 人声效果选择
    audioEffect(name) {
        if (!this.webAudio) {
            return this.local.effect = name
        }
        this.webAudio.audioEffect({ type: 'Convolver', name })
    }
}

// export default StreamOption;