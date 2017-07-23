// 引用插件
require('../../resource/desk-capture-share.crx')
// 引入样式文件
import './desktop.css';

let serverWs = MY.environment === 'dev' ? `${window.location.hostname}:${MY.wsPort}` : window.location.hostname

window.home = {
    // 是否已下载安装插件的重试
    isReTry: false,
    // 发送出去的rtc
    rtcOut: null,
    init() {
        this.initStatus()
        $('body').on('click', '.J-start', this.invoke.bind(this))
        $('body').on('click', '.J-video', function () {
            $('.J-video').toggleClass('full-screen');
        })
    },
    initStatus() {
        let roomId = window.location.href.match(/roomid=(\w+)?/gi)
        if (!roomId) return
        roomId = roomId[0].replace(/roomid=/gi, '');

        let url = `wss://${serverWs}/rtcWs`;
        let that = this;

        this.rtcOut = new rtcSDK();
        this.rtcOut.init({ url, roomId });

        this.rtcOut.on('stream', function (mediastream) {
            that.showVideo(mediastream);
        }.bind(this))

        this.rtcOut.on('stop', function (mediastream) {
            // that.toggleTip(false)
        }.bind(this))

        $('.J-start').toggleClass('hide', false)
        $('.J-share-url').html('您正在观看朋友分享的桌面哦~，如果您也想分享桌面的话，点击上面的体验按钮吧')
        $('.J-share-url').toggleClass('hide', false)
    },
    showVideo(mediastream) {
        $('.J-video')[0].srcObject = mediastream
        $('.J-video')[0].play()
    },
    toggleTip(isTip, text) {
        $('.J-start').toggleClass('hide', isTip)
        $('.J-share-url').html(text)
        $('.J-share-url').toggleClass('hide', !isTip)
    },
    invoke() {
        let that = this

        // 如果当前正在观看分享，先停掉rtc
        if (this.rtcOut && this.rtcOut.inited) {
            this.rtcOut.stop()
            this.rtcOut = null;
        }

        this.getLocalDesktopStream().then((stream) => {
            window.myLocalStream = stream;
            that.showVideo(stream)
            that.startRtc(stream)
        }).catch((err) => {
            console.error(err)
        })
    },
    getLocalDesktopStream() {
        // 根据平台检测使用不同的调用方式
        if (/firefox/gi.test(platform.name)) {
            return this.getFirefoxDesktop()
        } else {
            // 先尝试admin模式
            return this.getChromeDesktop().then((stream) => {
                return Promise.resolve(stream)
            }).catch(() => {
                return this.getChromeDesktopByExtension()
            })
        }
    },
    // 直接获取Firefox屏幕共享
    getFirefoxDesktop() {
        let config = {
            audio: true,
            video: {
                mediaSource: 'screen'
            }
        }
        return navigator.mediaDevices.getUserMedia(config).then(function (stream) {
            window.myLocalVideoStream = stream
            // let vn = document.createElement('video')
            // vn.srcObject = stream;
            // vn.play()
            // document.body.appendChild(vn)
            return Promise.resolve(stream)
        }).catch((err) => {
            console.log(err)
            return Promise.reject(err)
        });
    },
    // 直接获取chrome屏幕共享
    getChromeDesktop() {
        let config = { audio: false }
        config.video = {
            mandatory: {
                chromeMediaSource: 'screen',
                maxWidth: 1920,
                maxHeight: 1080
            },
            optional: [{
                googTemporalLayeredScreencast: true
            }]
        }
        return navigator.mediaDevices.getUserMedia(config).then(function (stream) {
            return Promise.resolve(stream)
        }).catch((err) => {
            console.log(err)
            return Promise.reject(err)
        });
    },
    // 通过浏览器插件获取chrome屏幕共享
    getChromeDesktopByExtension() {
        let that = this
        return invoke.start().then((obj) => {
            obj && console.log(obj)
            invoke.on('test', function (ms) {
                console.log('test: ', ms)
            })
            invoke.on('stop', function (ms, wss) {
                that.stopRTC()
                that.toggleTip(false)
            })
            return new Promise((resolve, reject) => {
                invoke.on('mediastream', function (ms, wss) {
                    console.log('媒体流：', ms, wss)
                    resolve(ms)
                })
            })
        }).catch(error => {
            alert(that.isReTry)

            function alert(isReTry) {

                Mt.alert({
                    title: '桌面共享目前需要安装一个插件哦',
                    msg: '下载完成后请手动拖入浏览器的扩展程序管理页面并刷新网页',
                    confirmBtnMsg: isReTry ? '已安装' : '下载',
                    cancelBtnMsg: '不分享了',
                    cb: function () {
                        if (isReTry) {
                            window.location.reload()
                            return
                        }
                        let url = '/static/resource/desk-capture-share.crx'
                        window.open(url, 'blank')
                        that.isReTry = true
                        alert(that.isReTry)
                    }
                });

            }
            console.log(error)
            return Promise.reject(error)
        })
    },
    // 连接rtc发送流
    startRtc(stream) {
        let roomId = Date.now() + ['a', 'b', 'c', 'd'][Math.floor(Math.random() * 4)]

        let url = `wss://${serverWs}/rtcWs`;

        this.rtcOut = new rtcSDK();
        this.rtcOut.init({ url, roomId, stream });


        url = window.location.origin + window.location.pathname + '?roomid=' + roomId;

        this.toggleTip(true, `复制下方连接给朋友吧，目前只支持一个朋友观看哦<br><p class="strong">${url}</p>`)
        console.log(url)
    },
    stopRTC() {
        this.rtcOut && this.rtcOut.stop();
    }
}
/** 
 * 使用方法：
 * 1. 调用invoke.start(), 返回一个promise
 * 2. then代表插件检测成功，返回一系列可以注册的监听事件列表，自定义事件监听
 * 3. catch代表插件检测失败，可以进行自定义提示
 */
let invoke = {
    // 连接插件的rtc
    rtcIn: null,
    isInited: false,
    // 插件id
    extensionId: 'aeilahanmchnodpfmboajalejjehglhl',
    isDesktopSupport: false,
    // 支持订阅的事件名称数组
    supportedEventList: null,
    // extension的命令，做什么事
    command: {
        DESKTOP_ONLY: '1',
        DESKTOP_AUDIO: '2'
    },
    // 回调监听
    listeners: {},
    // 注册监听回调事件
    on(name, fn) {
        this.listeners[name] = fn
    },
    // 初始化messge监听事件
    init() {
        let that = this
        if (this.isInited) return
        window.addEventListener("message", function (event) {
            if (event && event.data && event.data.from && event.data.from === 'middle-server') {
                let data = event.data.response
                if (event.data) that.isDesktopSupport = true
                if (data.code !== 200) {
                    Mt.alert({
                        title: data.error,
                        confirmBtnMsg: '好'
                    });
                }
                if (data.type && data.type === 'mediastream') {
                    that.getStream(data)
                    return
                }
                if (data.type) {
                    that.listeners[data.type] && that.listeners[data.type](data.data)
                }
                if (data.supportedEventList) {
                    that.supportedEventList = data.supportedEventList
                }
                console.log(event.data)
            }
        }, false);
        this.isInited = true
    },
    start() {
        if (this.checkPromise) return this.checkPromise
        this.init()
        let extensionId = this.extensionId
        // 这里要改一下
        window.postMessage({ from: "client", extensionId, type: this.command.DESKTOP_AUDIO }, "*");
        this.checkPromise = new Promise((resolve, reject) => {
            setTimeout(() => {
                this.checkPromise = null
                if (this.isDesktopSupport) return resolve(this.supportedEventList)
                return reject('no extension find')
            }, 500)
        })
        return this.checkPromise
    },
    // 连接rtc获取流
    getStream(data) {
        let that = this
        let url = data.wss
        this.rtcIn = new rtcSDK();

        this.rtcIn.init({ url });
        this.rtcIn.on('stream', function (mediastream) {
            that.listeners['mediastream'] && that.listeners['mediastream'](mediastream, url)
        }.bind(this))
        this.rtcIn.on('stop', function (mediastream) {
            that.listeners['stop'] && that.listeners['stop']()
        }.bind(this))
    }
}

// 入口
home.init()