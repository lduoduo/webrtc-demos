## 更新日志

### `20170714`

+ 优化websocet server代码，已完毕
+ firefox(54)和chrome(59) mac桌面版浏览器音视频已可以互通，移动端目前只能chrome和chrome互通
+ 文件传输有bug, 无法传输, 还未解决

#### bug
+ Failed to set remote answer sdp: Failed to push down transport description: Failed to set SSL role for the channel.
    -    addTrack / removeTrack / addStream / removeStream
    -    android firefox - firefox => android switch camera, video can refresh, audio no sound
    -    android chrome - chrome => android switch camera, video can refresh, audio no sound
    -    android chrome - firefox => android switch camera will cause error
+ Cannot create offer in state have-local-offer
+ Firefox - Android Firefox
    -    desktop start offer can build a connection while android start offer cant not
    -    android switch camera: desktop cant refresh remote streams