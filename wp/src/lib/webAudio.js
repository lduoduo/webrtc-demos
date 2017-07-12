/**
 * 音频音量控制和实时音量获取
 * 对github开源插件进行了重写：mediastream-gain
 * https://github.com/otalk/mediastream-gain
 * created by lduoduo
 * 音量获取参考:
 * https://webrtc.github.io/samples/src/content/getusermedia/volume/
 * 1. 音量控制
 * 2. 实时音量获取
 * 3. 多路音频输入
 * 注意：插件依赖 --> webrtcsupport
 */

/**
 * webaudio 控制
 * @param {MediaStream_Array} stream 音频输入流，可以有多个输入，详情在下方：
 * 单个输入的音频流可以更新替换为新的，但是多路输入目前无法进行更新
 * @param {Boolean} [isAnalyze=false] 是否需要监控分析，默认不分析
 */
function webAudio(stream, isAnalyze) {
    this.support = support.supportWebAudio && support.supportMediaStream

    this.gain = 1
    this.stream = stream

    if (!this.support) {
        return Promise.reject('webAudio not supported');
    }

    if (!this.stream) {
        return Promise.reject('no audio streams for webAudio');
    }

    this.context = new support.AudioContext()
    this.audioIn = {}

    this.isAnalyze = isAnalyze

    this.instant = 0.0
    this.slow = 0.0
    this.clip = 0.0

    this.init()

    return Promise.resolve(this)
}

const fn = webAudio.prototype

fn.init = function () {
    if (!this.validateInput()) return
    if (this.isAnalyze) {
        this.initMonitor()
    }

    this.initWebAudio()
    this.initAudioIn()

    // 初始化节点
    this.initAudioNode()
}

// 先验证输入流数据是否合法
fn.validateInput = function () {
    let stream = this.stream
    return /(Array|MediaStream)/.test(stream.constructor)
}

// 第一步：初始化音量分析监控的脚本节点
fn.initMonitor = function () {
    var that = this

    var scriptNode = this.script = this.context.createScriptProcessor(0, 1, 1)
    console.log(scriptNode.bufferSize)

    scriptNode.onaudioprocess = function (event) {
        var input = event.inputBuffer.getChannelData(0)
        var i
        var sum = 0.0
        var clipcount = 0
        for (i = 0; i < input.length; ++i) {
            sum += input[i] * input[i]
            if (Math.abs(input[i]) > 0.99) {
                clipcount += 1
            }
        }
        that.instant = Math.sqrt(sum / input.length)
        that.slow = 0.95 * that.slow + 0.05 * that.instant
        that.clip = clipcount / input.length
    }
}

// 第二步：初始化webaudio的连接工作
fn.initWebAudio = function () {
    let context = this.context

    this.gainFilter = context.createGain()
    this.destination = context.createMediaStreamDestination()

    this.gainFilter.gain.value = this.gain

    this.gainFilter.connect(this.destination)
}

// 第三步：初始化音频输入
fn.initAudioIn = function () {
    let that = this
    let stream = this.stream
    let context = this.context
    let tmp

    // 单路输入
    if (stream.constructor === MediaStream) {
        addMs(stream)
        this.outputStream = this.destination.stream
        return
    }

    // 多路输入
    if (stream.constructor === Array) {
        stream.forEach((item) => {
            tmp = addMs(item)
            if (tmp) {
                this.audioIn[item.id] = tmp
            }
        })
        this.outputStream = this.destination.stream
    }

    function addMs(ms) {
        if (ms.constructor !== MediaStream) return null
        if (ms.getAudioTracks().length === 0) return null
        let audioIn = context.createMediaStreamSource(ms)

        // 大坑问题！ script目前的代码是没有输出的，只作分析使用，所以source还要再连接一下下一个输出!
        if (that.isAnalyze && that.script) {
            audioIn.connect(that.script)
            that.script.connect(that.gainFilter)
        }

        audioIn.connect(that.gainFilter)
        return audioIn
    }
}

// 初始化音频播放节点
fn.initAudioNode = function () {
    this.node = document.createElement('audio')

    // 兼容
    if (this.node.srcObject === undefined) {
        let url = URL.createObjectURL(this.outputStream)
        this.node.src = url
    } else {
        this.node.srcObject = this.outputStream
    }

}

// 播放节点
fn.play = function () {
    this.node.play()
}

// 暂停播放节点
fn.pause = function () {
    this.node.pause()
}

// 恢复播放节点
fn.resume = function () {
    this.node.resume()
}

// 停止播放节点
fn.stop = function () {
    this.node.stop()
}

// 获取播放状态
fn.playStatus = function () {
    return !this.node.paused
}

// 动态加入音频流进行合并输出
fn.addStream = function (stream) {
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
}

// 更新流：全部替换更新
fn.updateStream = function (stream) {
    if (this.audioIn) {
        for (let i in this.audioIn) {
            this.audioIn[i] && this.audioIn[i].disconnect(0)
        }
    }
    this.audioIn = {}

    this.stream = stream
    this.initAudioIn()
}

// setting
fn.setGain = function (val) {
    // check for support
    if (!this.support) return
    this.gainFilter.gain.value = val
    this.gain = val
}

fn.getGain = function () {
    return this.gain
}

fn.off = function () {
    return this.setGain(0)
}

fn.on = function () {
    this.setGain(1)
}

fn.destroy = function () {
    this.instant = 0.0
    this.slow = 0.0
    this.clip = 0.0

    this.microphone && this.microphone.disconnect(0)
    this.gainFilter && this.gainFilter.disconnect(0)
    this.script && this.script.disconnect(0)

    if (this.audioIn) {
        for (let i in this.audioIn) {
            this.audioIn[i] && this.audioIn[i].disconnect(0)
        }
    }
    this.audioIn = {}

    this.context && this.context.close()
    let ms = this.stream
    let outms = this.outputStream

    dropMS(outms)
    if (ms.constructor === MediaStream) {
        dropMS(ms)
    }
    if (ms.constructor === Array) {
        ms.forEach((item) => {
            dropMS(item)
        })
    }

    function dropMS(mms) {
        if (!mms) return
        let tracks = mms.getTracks()
        if (!tracks || tracks.length === 0) return
        // 这里不要移除轨道!!!
        // mms.getTracks().forEach(function (track) {
        //   track.stop()
        //   mms.removeTrack(track)
        // })
    }

    this.stream = null
    this.outputStream = null
}

fn.getVolumeData = function () {
    // return {
    //   instant: this.instant.toFixed(2),
    //   slow: this.slow.toFixed(2),
    //   clip: this.clip.toFixed(2)
    // }
    return this.instant.toFixed(2)
}

window.webAudio = webAudio
// module.exports = webAudio
