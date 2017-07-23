/**
 * mediastream录制音视频功能
 * createdby lduoduo
 * 1. 支持单个video录制
 * 2. 不支持多个video录制
 * 3. 支持混录audio
 * 4. 命名方式：{
 *  video: 视频录制
 *  remix: 混音录制
 * }
 * 5. 调用方式:
 *  new RecordRTC(streams, option{type})
    .then(obj => {
      this.recordRTC = obj
      return Promise.resolve()
    })
    .catch(err => {
      return Promise.reject(err)
    })
    tips: 插件依赖: webAudio.js
 */
function MR(stream, option = { type: 'video' }) {
  if (!stream) return Promise.reject('获取视频流失败')
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return Promise.reject('当前浏览器不支持音视频录制功能')

  this.recordedChunks = []
  this.isRecording = false
  this.stream = stream
  this.option = option

  let contentTypes = [
    'video/mp4;codecs=avc1',
    'video/webm',
    'video/webm;codecs=vp8',
    'video/x-matroska;codecs=avc1',
    'video/invalid'
  ]
  if (option.type === 'audio') {
    contentTypes = [
      'audio/wav',
      'audio/ogg',
      'audio/pcm',
      'audio/webm'
    ]
  }

  let mimeType = this.mimeType = this.validation(contentTypes)[0]

  if (!mimeType) return Promise.reject('当前浏览器不支持对应格式的视频录制')

  return this.start()
}

MR.prototype = {
  validation(arr) {
    return arr.filter((item) => {
      return MediaRecorder.isTypeSupported(item)
    })
  },

  /**
   * 格式化音视频、多轨合并
   * 返回处理好的音视频流
   */
  format() {
    let streams = this.stream
    let option = this.option
    return new Promise((resolve, reject) => {
      // 注：Firefox通过API获取的原生流构造函数是：LocalMediaStream
      if (/(LocalMediaStream|MediaStream)/.test(streams.constructor)) {
        streams = [streams]
      }
      if (streams.constructor !== Array) {
        return reject('音视频录制输入错误')
      }

      // 如果是混音录制，需要用webaudio api处理
      // 为什么这么做：单纯的合并很多音频轨道到一个流里面并不能录制全部
      if (option.type === 'audio') {
        this.audioController = new webAudio(streams, this.uid)
        this.opStream = this.audioController.outputStream
        return resolve()
      }

      let opStream = new MediaStream()
      // 取出所有视频轨道和音频轨道
      streams.forEach((stream) => {
        if (!stream || !/(LocalMediaStream|MediaStream)/.test(stream.constructor)) return
        stream.getTracks().forEach((track) => {
          opStream.addTrack(track)
        })
      })

      if (opStream.getTracks().length === 0) {
        return reject('当前没有任何音视频数据，无法进行录制')
      }
      this.opStream = opStream
      resolve()
    })
  },
  start() {
    if (this.isRecording) return Promise.reject('音视频正在录制中，请勿重复操作')

    let options = {
      audioBitsPerSecond: 128000,
      videoBitsPerSecond: 2500000,
      mimeType: this.mimeType
    }
    // 进行格式化
    return this.format().then(() => {
      let recorder = this.recorder = new MediaRecorder(this.opStream, options)
      recorder.ondataavailable = this.ondataavailable.bind(this)
      recorder.onstop = this.onstop.bind(this)

      this.recorder.start()
      // 启用日志打印
      this.startTimer()
      return Promise.resolve(this)
    }).catch(e => {
      return Promise.reject(e)
    })
  },
  stop(fileName) {
    console.log('MediaRecorder: stop event', this.recorder.state)
    if (this.recorder.state === 'inactive') {
      console.warn('MediaRecorder already stopped:', this.recorder.state)
      return Promise.reject('音视频录制已结束，请勿重复操作')
    }
    // 默认文件名
    let fileNameDefault = `ldodo--${Date.now()}--${this.option.type || 'video'}`
    this.fileName = fileName || fileNameDefault
    if (!this.recorder) return Promise.reject('音视频录制已结束，请勿重复操作')
    this.recorder && this.recorder.stop()

    return Promise.resolve()
  },
  ondataavailable(event) {
    console.log('MediaRecorder: data received')
    if (event.data.size > 0) {
      this.recordedChunks.push(event.data)
    } else {
      this.stop()
      return Promise.reject('获取视频流失败')
    }
  },
  onstop() {
    console.log('MediaRecorder: onstop')
    let blob = new Blob(this.recordedChunks, {
      type: this.mimeType
    })
    let url = URL.createObjectURL(blob)
    let a = document.createElement('a')
    document.body.appendChild(a)
    a.style = 'display: none'
    a.href = url
    a.download = this.fileName + '.webm'
    a.click()
    window.URL.revokeObjectURL(url)

    this.destroy()
    this.clearTimer()
  },
  pause() {
    this.recorder && this.recorder.pause()
  },
  resume() {
    this.recorder && this.recorder.resume()
  },
  destroy() {
    this.stream = null
    this.recorder = null
    this.recordedChunks = []
    this.audioController && this.audioController.destroy()
    this.audioController = null
  },
  startTimer() {
    if (this.timer) return
    this.timer = setInterval(() => {
      console.log('MediaRecorder status:', this.recorder.state)
    }, 2000)
  },
  clearTimer() {
    if (!this.timer) return
    clearInterval(this.timer)
  }
}
window.MR = MR
// export default MR
