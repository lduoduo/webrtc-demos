## 实时文字聊天
> 主要用到了WebRTC三大API中的 `RTCDataChannel`

### 浏览器支持: Chrome / Filefox
### RTCDataChannel
数据通道，顾名思义，就是p2p之间传输任意数据的通道，需要手动开启，方法如下
```
// 创建数据通道, label为自定义的通道标签值，在多通道管理是很有用
let channel = rtcConnection.createDataChannel(label);
// 通道事件注册
channel.onopen = function () {
    // 通道完全开启后的回调
    console.log(`dataChannel opened, ready now`);
};
channel.onerror = function (error) {
    // 数据传输过程中发生错误都可以在这里捕获
    console.error(`dataChannel error:`, error);
};
channel.onmessage = function (event) {
    // 通道传输过来的数据
    console.log('dataChannel message:', event.data)
};
channel.onclose = function (data) {
    // 通道对端关闭通道的回调，告知己方做相应处理, 例如自己也关闭对应通道
    console.warn(`dataChannel closed now`);
};
```

+ 可以创建多条通道进行数据的并发传输，例如发送多个文件时，可以这么做
+ RTCDataChannel 目前传输的数据格式支持情况: JSON / ArrayBuffer / Blob(Blob目前只有Firefox支持)
+ [API文档地址](//developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection)
