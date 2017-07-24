/**
 * 音频音量控制和实时音量获取
 * 对github开源插件进行了重写：mediastream-gain
 * https://github.com/otalk/mediastream-gain
 * created by hzzouhuan on 20170613
 * 音量获取参考:
 * https://webrtc.github.io/samples/src/content/getusermedia/volume/
 * 1. 音量控制
 * 2. 实时音量获取
 * 3. 多路音频输入
 * 注：插件依赖 webrtcsupport.js
 */

// var support = require('webrtcsupport')

/**
 * webaudio 控制
 * @param {MediaStream_Array} option.stream 音频输入流，可以有多个输入，详情在下方：
 * 单个输入的音频流可以更新替换为新的，但是多路输入目前无法进行更新
 * @param {Boolean} [option.isAnalyze=false] 是否需要监控分析，默认不分析
 * @param {string} [option.effect] 效果器
 */

var webAudio = function (option) {

    this.support = support.supportWebAudio && support.supportMediaStream

    // set our starting value
    this.gain = 1
    this.stream = option.stream

    if (!this.support) {
        return Promise.reject('webAudio not supported');
    }

    if (!this.stream) {
        return Promise.reject('no audio streams for webAudio');
    }

    this.audioIn = {}

    this.isAnalyze = option.isAnalyze
    this.effect = option.effect

    this.instant = 0.0
    this.slow = 0.0
    this.clip = 0.0

    this.init()

    return Promise.resolve(this)
}

// N个实例对应一个环境
webAudio.ac = new support.AudioContext()
webAudio.destination = webAudio.ac.createMediaStreamDestination()

webAudio.prototype = {
    context: webAudio.ac,
    bufferList: {},
    init() {
        if (!this.validateInput()) return
        if (this.isAnalyze) {
            this.initMonitor()
        }

        this.initWebAudio()
        this.initAudioIn()

        // 初始化节点
        this.initAudioNode()
    },

    // 先验证输入流数据是否合法
    validateInput() {
        var stream = this.stream
        // 注：Firefox通过API获取的原生流构造函数是：LocalMediaStream
        return /(Array|MediaStream|LocalMediaStream)/.test(stream.constructor)
    },

    // 第一步：初始化音量分析监控的脚本节点
    initMonitor() {
        var that = this

        var scriptNode = this.script = this.context.createScriptProcessor(0, 1, 1)
        console.log(scriptNode.bufferSize)

        scriptNode.onaudioprocess = function (event) {
            var input = event.inputBuffer.getChannelData(0)
            var i
            var sum = 0.0
            var clipcount = 0
            for (i = 0; i < input.length; ++i) {
                sum += Math.abs(input[i])
                if (Math.abs(input[i]) > 0.99) {
                    clipcount += 1
                }
            }
            that.instant = Math.sqrt(sum / input.length)
            that.slow = 0.95 * that.slow + 0.05 * that.instant
            that.clip = clipcount / input.length
        }
    },

    // 第二步：初始化webaudio的连接工作
    initWebAudio() {
        var context = this.context

        // 增益
        this.gainFilter = context.createGain()

        // 滤波器，可以通过该处理器对音乐进行降噪、去人声等处理 chrome55以上
        this.biquadFilter = context.createBiquadFilter();
        // Manipulate the Biquad filter
        this.biquadFilter.type = "lowshelf";
        this.biquadFilter.frequency.value = 400;
        this.biquadFilter.gain.value = 25;

        // 动态压缩器节点
        this.compressor = context.createDynamicsCompressor();
        this.compressor.threshold.value = -50;
        this.compressor.knee.value = 40;
        this.compressor.ratio.value = 12;
        this.compressor.attack.value = 0;
        this.compressor.release.value = 0.25;

        // 混响
        // this.convolver = context.createConvolver();

        // 目的地
        this.destination = webAudio.destination

        this.gainFilter.gain.value = this.gain

        this.gainFilter.connect(this.destination)

        // 是否加效果
        if (this.effect) {
            this.audioEffect(this.effect)
        }

        // this.biquadFilter.connect(this.compressor)

        // this.compressor.connect(this.destination)

        // this.convolver.connect(this.destination)


    },

    // 第三步：初始化音频输入
    initAudioIn() {
        var that = this
        var stream = this.stream
        var context = this.context
        var tmp

        // 单路输入
        if (/(MediaStream|LocalMediaStream)/.test(stream.constructor)) {
            addMs(stream)
            this.outputStream = this.destination.stream
            return
        }

        // 多路输入
        if (stream.constructor === Array) {
            stream.forEach(item => {
                if (!item || !/(MediaStream|LocalMediaStream)/.test(item)) return

                tmp = addMs(item)
                if (tmp) {
                    this.audioIn[item.id] = tmp
                }
            })
            this.outputStream = this.destination.stream
        }

        function addMs(ms) {
            if (!/(MediaStream|LocalMediaStream)/.test(ms.constructor)) return null
            if (ms.getAudioTracks().length === 0) return null
            var audioIn = context.createMediaStreamSource(ms)

            // 大坑问题！ script目前的代码是没有输出的，只作分析使用，所以source还要再连接一下下一个输出!
            if (that.isAnalyze && that.script) {
                audioIn.connect(that.script)
                that.script.connect(that.gainFilter)
            }

            audioIn.connect(that.gainFilter)
            return audioIn
        }
    },

    // 初始化音频播放节点
    initAudioNode() {
        this.node = document.createElement('audio')

        // 兼容
        if (this.node.srcObject === undefined) {
            var url = URL.createObjectURL(this.outputStream)
            this.node.src = url
        } else {
            this.node.srcObject = this.outputStream
        }

    },

    // 应用效果器
    audioEffect(type) {

        this.effect = type

        if (!this.convolver) {
            this.convolver = this.context.createConvolver();
        }

        this.convolver.buffer = this.bufferList[type]

        this.gainFilter.disconnect()
        this.convolver.disconnect()

        this.gainFilter.connect(this.convolver)
        this.convolver.connect(this.destination)        

    },
    // 播放节点
    play() {
        this.node.play()
    },

    // 暂停播放节点
    pause() {
        this.node.pause()
    },

    // 恢复播放节点
    resume() {
        this.node.resume()
    },

    // 停止播放节点
    stop() {
        this.node.stop()
    },

    // 获取播放状态
    playStatus() {
        return !this.node.paused
    },

    // 动态加入音频流进行合并输出
    addStream(stream) {
        if (stream.getAudioTracks().length === 0) {
            return
        }
        var audioIn = context.createMediaStreamSource(stream)
        if (this.isAnalyze && this.script) {
            audioIn.connect(this.script)
        }
        audioIn.connect(this.gainFilter)
        this.audioIn[stream.id] = audioIn
        this.outputStream = this.destination.stream
    },

    // 更新流：全部替换更新
    updateStream(stream) {
        if (this.audioIn) {
            for (var i in this.audioIn) {
                this.audioIn[i] && this.audioIn[i].disconnect(0)
            }
        }
        this.audioIn = {}

        this.stream = stream
        this.initAudioIn()
    },

    // setting
    setGain(val) {
        // check for support
        if (!this.support) return
        this.gainFilter.gain.value = val
        this.gain = val
    },

    getGain() {
        return this.gain
    },

    off() {
        return this.setGain(0)
    },
    on() {
        this.setGain(1)
    },

    destroy() {
        this.instant = 0.0
        this.slow = 0.0
        this.clip = 0.0

        this.microphone && this.microphone.disconnect(0)
        this.gainFilter && this.gainFilter.disconnect(0)
        this.script && this.script.disconnect(0)

        if (this.audioIn) {
            for (var i in this.audioIn) {
                this.audioIn[i] && this.audioIn[i].disconnect(0)
            }
        }
        this.audioIn = {}

        this.context && this.context.close()
        var ms = this.stream
        var outms = this.outputStream

        dropMS(outms)
        if (!/(MediaStream|LocalMediaStream)/.test(ms.constructor)) {
            dropMS(ms)
        }
        if (ms.constructor === Array) {
            ms.forEach(item => {
                dropMS(item)
            })
        }

        function dropMS(mms) {
            if (!mms) return
            var tracks = mms.getTracks()
            if (!tracks || tracks.length === 0) return
            // 这里不要移除轨道!!!
            // mms.getTracks().forEach(function (track) {
            //   track.stop()
            //   mms.removeTrack(track)
            // })
        }

        this.stream = null
        this.outputStream = null
    },

    getVolumeData() {
        // return {
        //   instant: this.instant.toFixed(2),
        //   slow: this.slow.toFixed(2),
        //   clip: this.clip.toFixed(2)
        // }
        return this.instant.toFixed(2)
    },
    // 加载效果器, list: url的list
    loadEffect(list) {
        return this.loadBufferList(list).then(() => {
            return Promise.resolve(Object.keys(this.bufferList))
        });
    },
    // 拉取buffer列表
    loadBufferList(list) {
        var p = [];
        list.forEach((url) => {
            p.push(this.loadBuffer(url))
        })
        return Promise.all(p)
    },
    // 拉取arraybuffer数据
    loadBuffer(url) {
        var that = this;

        return new Promise((resolve, reject) => {
            // Load buffer asynchronously
            var request = new XMLHttpRequest();
            request.open("GET", url, true);
            request.responseType = "arraybuffer";

            var name = url.match(/.(\w+)\.(wav|mp3)$/)
            name = name.length >= 2 ? name[1] : name[0]

            request.onload = function () {

                // Asynchronously decode the audio file data in request.response
                that.context.decodeAudioData(
                    request.response,
                    function (buffer) {
                        if (!buffer) {
                            console.error('error decoding file data: ' + url);
                            resolve()
                            return;
                        }
                        that.bufferList[name] = buffer;
                        resolve()
                    },
                    function (error) {
                        console.error('decodeAudioData error', error);
                        resolve()
                    }
                );
            }

            request.onerror = function () {
                alert('BufferLoader: XHR error');
                resolve()
            }

            request.send();
        })
    }
}

window.webAudio = webAudio