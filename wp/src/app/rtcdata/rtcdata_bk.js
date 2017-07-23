// 引入样式文件
import './rtcdata.less';

// 音视频画面容器
let $localVideo = document.querySelector('.J-local-video');
let $remoteVideo = document.querySelector('.J-remote-video');

let serverWs = MY.environment === 'dev' ?  window.location.hostname + ':8099' : window.location.hostname

window.home = {
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

    init() {
        this.initEvent();
    },
    initEvent() {
        let that = this
        $('body').on('click', '.J-start', this.startRTC.bind(this))
        $('body').on('click', '.J-startMedia', this.controlMedia.bind(this))
        $('body').on('click', '.J-send', function () {
            that.sendData($('.J-rtc-data').val())
        })
        $('body').on('click', '.J-rtc-file', function () {
            $('#fileInput').click()
        })
        $('body').on('change', '#fileInput', this.selectedFile.bind(this))
        $('body').on('click', '.J-remote-video', function () {
            let local = $localVideo.srcObject
            let remote = $remoteVideo.srcObject
            $localVideo.srcObject = local
            $remoteVideo.srcObject = remote
        })
        $('body').on('click', '.J-capture', function () {
            $('.J-capture').toggleClass('active')
            if ($('.J-capture').hasClass('active')) {
                if (!$remoteVideo.srcObject) {
                    Mt.alert({
                        title: '当前没有远程视频流，无法截图',
                        confirmBtnMsg: '好'
                    });
                    return
                }
                that.setupCanvas()
                $('.J-capture').html('关闭远程视频截图')
            } else {
                that.closeCanvas()
                $('.J-capture').html('开启远程视频截图[对端接收并显示]')
            }
        })

        window.addEventListener('beforeunload', this.destroy.bind(this));
    },
    destroy() {
        if (!this.rtc) return
        this.rtc.stop()
    },
    controlMedia(e) {
        if (!this.localStream) {
            this.initDevice().then(()=>{
                $(e.target).text('关闭音视频')
            })
            return
        }
        this.stopDevice()
        $(e.target).text('开启音视频')
    },
    // 关闭音视频
    stopDevice() {
        let stream = this.localStream
        stream.getTracks().forEach(track => {
            track.stop()
            stream.removeTrack(track)
        })
        this.localStream = stream = null

        this.updateStream()
    },
    /**
    * 开启音视频
    */
    initDevice() {
        return this.getDevices().then(function (devices) {
            devices = devices.video;
            return this.startLocalStream(devices[0].deviceId);
        }.bind(this));
    },
    /**
     * 获取设备列表
     * 
     * @returns obj 设备列表对象
     */
    getDevices() {
        return new Promise(function (resolve, reject) {
            // 文档见: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                // console.log("your browser not support this feature");
                return reject(new Error("your browser not support this feature, see https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices"));
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
        let videoSetting = ['1280', '720', '20'];
        return new Promise(function (resolve, reject) {
            navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: deviceId,
                    width: videoSetting[0],
                    height: videoSetting[1],
                    frameRate: videoSetting[2]
                },
                audio: true
            }).then(function (stream) {
                resolve(stream);
            }).catch(reject);
        });
    },
    startLocalStream(deviceId) {
        let that = this;
        return this.getLocalStream(deviceId).then((stream) => {
            that.localStream = stream;
            // $localVideo.volume = 0;
            $localVideo.autoplay = true;
            $localVideo.srcObject = stream;

            that.updateStream(stream)
            return Promise.resolve()
        }).catch((e) => {
            // mylog("<font>can't get local camera, see console error info</font>", '', 'error');
            console && console.error && console.error(e);
            return Promise.reject(e)
        });
    },
    // 选择文件, 多文件
    selectedFile() {
        let fileInput = document.querySelector('input#fileInput')
        let files = fileInput.files

        for (let i in files) {
            let tmp = files[i]
            tmp.constructor === File && this.sendFile(tmp)
        }
    },
    // blob入口
    sendBlobs(){
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
            this.canvasTimer = setInterval(next.bind(this), 100)
        })

        function next() {
            // 先重绘
            ctx.drawImage($localVideo, 0, 0, 500, 400);
            canvas.toBlob(function (blob) {
                blob.name = 'canvas'
                // blob.type = 'blob'
                console.log('canvas data:', blob)
                that.sendCanvas(that.canvasChannelId,blob)
            }, 'image/jpeg');
        }

    },
    // 单个blob发送
    sendBlob(cid, blob){
        this.rtc.sendBlob(cid, blob)
    },
    // 单个文件发送
    sendFile(file) {
        if (!this.rtc || !this.rtc.inited) return

        let that = this
        let size = file.size;
        let name = file.name;
        let chunkSize = 16384;
        let channelId = null;
        this.rtc.updateData({
            type: 'file',
            channelType: 'ArrayBuffer',
            data: {
                name,
                size,
                chunkSize
            }
        }).then(cid => {
            // console.log(cid)
            if (!cid) return

            channelId = cid
            sliceFile(0);
        })

        // this.sendData({ type: 'file', data: { name, size, chunkSize } })

        function sliceFile(offset) {
            var reader = new FileReader();
            reader.onload = (function () {
                return function (e) {
                    let data = e.target.result
                    // that.sendData({ type: 'file', data: { data } });
                    that.sendData({ channelId, data });

                    if (file.size > offset + e.target.result.byteLength) {
                        setTimeout(sliceFile, 0, offset + chunkSize);
                    }
                    else {
                        that.sendData({ channelId, data: null });
                    }
                    // sendProgress.value = offset + e.target.result.byteLength;
                };
            })(file);
            var slice = file.slice(offset, offset + chunkSize);
            reader.readAsArrayBuffer(slice);
        };

    },
    // 调用api发送数据的统一收口
    sendData(data) {
        if (!this.rtc || !this.rtc.inited) return
        // let data = $('.J-rtc-data').val()
        if (!data) return
        // if (data.constructor !== ArrayBuffer) { data = JSON.stringify(data) }

        this.rtc.updateData(data).then(channelId => {
            console.log(channelId)
        }).catch(err => {
            console.warn(err)
        })
    },
    // 这里讲音视频数据转成blob
    updateStream(stream) {
        window.myLocalStream = stream;
        // let blob = new Blob(stream, {
        //     type: 'image/jpeg'
        // });

        if (this.rtc && this.rtc.inited) {
            this.rtc.updateStream(stream)
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

         let url = `wss://${serverWs}/rtcWs`;

        let rtc = this.rtc = new rtcSDK();
        rtc.init({ url, roomId: cname, stream }).then(obj => {
            console.log('支持的注册事件:', obj)
        }).catch(err => {
            Mt.alert({
                title: 'webrtc连接失败',
                msg: JSON.stringify(err),
                confirmBtnMsg: '好哒'
            })
        })

        rtc.on('stream', this.startRemoteStream.bind(this))
        rtc.on('data', this.startRemoteData.bind(this))
        rtc.on('stop', this.stopRTC.bind(this))
        rtc.on('ready', this.rtcStatus.bind(this))
        rtc.on('sendFile', this.sendFileStatus.bind(this))
        rtc.on('receiveFile', this.receiveFileStatus.bind(this))
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
    // 发送文件状态回传
    sendFileStatus(data){
        console.log(data)
    },
    // 接收文件状态回传
    receiveFileStatus(data){
        console.log(data)
    },
    // 接收远程数据
    startRemoteData(result) {

        console.log('remote data:', result);

        // 纯字符串数据
        if (result.constructor === String) return

        if (result.constructor === Object) {
            let {type, channelId, data} = result

            // 初始化文件接收工作
            if (type && /(file|image|canvas)/.test(type) && channelId) {
                let tmp = this.remote[channelId] = {}
                tmp.size = data.size
                tmp.receivedSize = 0
                tmp.name = data.name
                tmp.type = type
                tmp.buffer = []
                return
            }

            // 文件接收
            if (data && data.constructor === ArrayBuffer) {
                return this.onReceiveFile(result)
            }
        }
    },
    // 接收文件
    onReceiveFile(result = {}) {
        let {channelId, data} = result
        if (!channelId || data.constructor !== ArrayBuffer) return

        let tmp = this.remote[channelId]
        let receiveBuffer = tmp.buffer

        receiveBuffer.push(data);
        tmp.receivedSize += data.byteLength;

        // receiveProgress.value = receivedSize;

        // we are assuming that our signaling protocol told
        // about the expected file size (and name, hash, etc).

        if (tmp.receivedSize === tmp.size) {
            this.showReceivedFile(tmp)
        }
    },
    // 接收到一个文件，进行显示
    showReceivedFile(data) {
        let receiveBuffer = data.buffer
        let receivedSize = data.receivedSize
        let received = new window.Blob(receiveBuffer);
        receiveBuffer = [];

        // 如果是文件，展示为下载链接
        if (data.type === 'file') {
            let a = document.createElement('a')
            a.href = URL.createObjectURL(received);
            a.download = data.name;
            a.textContent = `收到文件,点击下载: ${data.name} ( ${data.size} bytes)`;
            a.style.display = 'block';
            a.style.background = '#fff';

            $('.rtc__file')[0].parentNode.appendChild(a)
            return
        }
        // 如果是图片，进行canvas渲染
        if (/image/.test(data.type)) {
            let canvas = this.canvas = document.querySelector('.J-canvas')
            let ctx = canvas.getContext('2d');

            let img = new Image();
            let url = URL.createObjectURL(received);

            img.onload = function () {
                canvas.width = img.width
                canvas.height = img.height
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
            }

            img.src = url;
        }
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


