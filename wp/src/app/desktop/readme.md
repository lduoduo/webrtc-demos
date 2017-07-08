## 屏幕共享
> 需要依赖chrome浏览器插件 [请点击跳转查看](//github.com/lduoduo/my-chrome-extensions/tree/master/desk-capture-share)

+ 为什么要依赖插件？
    - 后面会解释

### 屏幕捕捉

目前WebRTC三大API中的 `getUserMedia` 允许网页中的js脚本直接捕捉摄像头、麦克风，代码如下
```
let constrant = {audio:true}
navigator.mediaDevices.getUserMedia(constrant).then(function (stream) {
    mylocalVideo = stream
    window.anode = document.createElement('video')
    anode.srcObject = stream
    anode.controls = true
    anode.play()
    document.body.appendChild(anode)
}).catch((e) => {
    let error = `启动摄像头失败: ${e.name}`
    console.log(e)
})
```
> constrant 为获取设备麦克风和浏览器的约束条件，包括是否抓取音频，视频，视频大小，码率等等, 具体参见 [constrants](//developer.mozilla.org/en-US/docs/Web/API/MediaStreamConstraints)

> 如果要抓取屏幕内容, constrant需要设置为

```
constraints = {
    audio: false,
    video: {
        mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: chromeMediaSourceId,
        },
        optional: [
            { googTemporalLayeredScreencast: true },
            { bandwidth: resolutions.maxWidth * 8 * 1024 }
        ]
    }
};
```
这是Chrome实验性的一个限制条件{‘chromeMediaSource’:’screen’}，可以像使用流媒体源一样使用屏幕。

+ 屏幕共享目前还不够成熟，谷歌还未完全开放，普通代码里通过上面这段会捕捉失败，如果要成功捕捉，目前有两种办法
1. 开启浏览器的时候加入flag: --enable-usermedia-screen-capturing
    - windows 系统可以右击浏览器快捷方式，在目标一栏，加上上面的flag
2. 通过浏览器插件来帮助捕获屏幕流，通过rtc点对点连接获取流并外显

+ 谷歌屏幕共享目前无法同时捕获声音，需要自己单独开一个 `getUserMedia` 来捕捉音频

备注
> 由于浏览器安全性策略，音视频、屏幕流的捕捉都需要在 `https` 模式下才能捕获

### Firefox需要插件吗?
Firefox不需要, 并且Firefox支持同时捕捉屏幕流和音频流
```
let config = {
    audio: true,
    video: {
        mediaSource: 'window' || 'screen'
    }
}
return navigator.mediaDevices.getUserMedia(config).then(function (stream) {
    window.myLocalVideoStream = stream
    let vn = document.createElement('video')
    vn.srcObject = stream;
    vn.play()
    document.body.appendChild(vn)
    return Promise.resolve(stream)
}).catch((err) => {
    console.log(err)
});
```

### 屏幕捕捉的血泪史
1. background.js capture the desktop stream and deliver to web page through content script
> `FAIL`: the stream web page get was an empty object

2. background.js capture the desktop stream and transfer to a blob url, deliver this url to web page
> `FAIL`: Not Allowed to load local resource blob

3. background.js capture the desktop stream, start a local sockt server, use webrtc to deliver to web page
> `FAIL`: 'sockets' is only allowed for packaged apps, but this is a extension

4. background.js capture the desktop stream, attach to webrtc through further socket server, content script also use webrtc to get this stream, deliver to web page
> `FAIL`: Uncaught DOMException: Failed to excute 'postMessage' on 'Window': MediaStream Object could not be cloned

5. background.js capture the desktop stream, attach to webrtc through further socket server, web page use webrtc to get this stream
>  `SUCCESS!`