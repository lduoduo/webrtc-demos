// created by @HenrikJoreteg
// https://github.com/HenrikJoreteg/webrtcsupport

(function () {
    var prefix;
    var version;

    // 1. getUserMedia
    var getUserMedia = navigator.getUserMedia = navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices = navigator.mediaDevices || {}
        navigator.mediaDevices.getUserMedia = function (constraints) {
            return new Promise(function (resolve, reject) {
                if (!navigator.getUserMedia) {
                    return reject('当前浏览器还不支持API: getUserMedia')
                }
                navigator.getUserMedia(constraints, function (stream) {
                    resolve(stream)
                }, function (err) {
                    reject(err)
                });
            })
        }
    }

    // 2. AudioContext
    var AudioContext = window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;

    // 3. RTCPeerConnection
    var RTCPeerConnection = window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;

    // 4. RTCDataChannel
    var RTCDataChannel = window.RTCDataChannel = window.RTCDataChannel || window.DataChannel;

    // 5. RTCSessionDescription
    var RTCSessionDescription = window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription;

    // 6. RTCIceCandidate
    var RTCIceCandidate = window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate;

    // 7. MediaStream
    var MediaStream = window.MediaStream = window.MediaStream || window.webkitMediaStream;

    if (window.mozRTCPeerConnection || navigator.mozGetUserMedia) {
        prefix = 'moz';
        version = parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);
    } else if (window.webkitRTCPeerConnection || navigator.webkitGetUserMedia) {
        prefix = 'webkit';
        version = navigator.userAgent.match(/Chrom(e|ium)/) && parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2], 10);
    }

    var screenSharing = window.location.protocol === 'https:' &&
        ((prefix === 'webkit' && version >= 26) ||
            (prefix === 'moz' && version >= 33))

    var videoEl = document.createElement('video');
    var supportVp8 = videoEl && videoEl.canPlayType && videoEl.canPlayType('video/webm; codecs="vp8", vorbis') === "probably";


    // export support flags and constructors.prototype && PC
    window.support = {
        prefix: prefix,
        browserVersion: version,
        support: !!getUserMedia || !!RTCPeerConnection,
        // new support style
        supportRTCPeerConnection: !!RTCPeerConnection,
        supportVp8: supportVp8,
        supportGetUserMedia: !!getUserMedia,
        supportDataChannel: !!(RTCPeerConnection && RTCPeerConnection.prototype && RTCPeerConnection.prototype.createDataChannel),
        supportWebAudio: !!(AudioContext && AudioContext.prototype.createMediaStreamSource),
        supportMediaStream: !!(MediaStream && MediaStream.prototype.removeTrack),
        supportScreenSharing: !!screenSharing,
        // constructors
        AudioContext: AudioContext,
        RTCPeerConnection: RTCPeerConnection,
        RTCSessionDescription: RTCSessionDescription,
        RTCIceCandidate: RTCIceCandidate,
        MediaStream: MediaStream,
        getUserMedia: getUserMedia
    };

})()