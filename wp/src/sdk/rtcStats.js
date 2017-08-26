'use strict';

// Last time updated: 2017-08-23 7:46:28 AM UTC

// _______________
// getStats v1.0.4

// Open-Sourced: https://github.com/muaz-khan/getStats

// --------------------------------------------------
// Muaz Khan     - www.MuazKhan.com
// MIT License   - www.WebRTC-Experiment.com/licence
// --------------------------------------------------

// 
/**
 * 调用方法
 * 1. 初始化: var getStats = new GetStats(rtcConnection, interval)
 * 2. 开启监控: getStats.start()
 * 3. 关闭监控: getStats.stop()
 * 4. 回调监听: getStats.on('stats', onStats.bind(onStats))
 */
import Event from './event'

export default class GetStats extends Event {
    constructor(option) {
        super()
        this.peer = option.peer
        this.mediaStreamTrack = option.mediaStreamTrack
        this.interval = option.interval

        if (this.peer instanceof RTCPeerConnection) {

            if (!(this.mediaStreamTrack instanceof MediaStreamTrack) && !!navigator.mozGetUserMedia) {
                throw '2nd argument is not instance of MediaStreamTrack.';
            }

        } else if (!(this.mediaStreamTrack instanceof MediaStreamTrack) && !!navigator.mozGetUserMedia) {
            throw '1st argument is not instance of MediaStreamTrack.';
        }

        this.init()
    }
    init() {
        let { mediaStreamTrack } = this
        let RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;

        if (typeof MediaStreamTrack === 'undefined') {
            MediaStreamTrack = {}; // todo?
        }
        this.reset()
        this.initStatsResult()
        this.initStatsParser()
        this.initStatsParserFn()
    }
    reset() {
        this.nomore = false
        this.AUDIO_codecs = ['opus', 'isac', 'ilbc'];
        this.VIDEO_codecs = ['vp9', 'vp8', 'h264'];
        this.SSRC = {
            audio: {
                send: [],
                recv: []
            },
            video: {
                send: [],
                recv: []
            }
        };
        this.LOCAL_candidateType = [];
        this.LOCAL_transport = [];
        this.LOCAL_ipAddress = [];
        this.LOCAL_networkType = [];

        this.REMOTE_candidateType = [];
        this.REMOTE_transport = [];
        this.REMOTE_ipAddress = [];
        this.REMOTE_networkType = [];
    }
    initStatsResult() {
        let systemNetworkType = ((navigator.connection || {}).type || 'unknown').toString().toLowerCase();
        this.statsResult = {
            encryption: 'sha-256',
            audio: {
                send: {
                    tracks: [],
                    codecs: [],
                    availableBandwidth: 0,
                    streams: 0
                },
                recv: {
                    tracks: [],
                    codecs: [],
                    availableBandwidth: 0,
                    streams: 0
                },
                bytesSent: 0,
                bytesReceived: 0
            },
            video: {
                send: {
                    tracks: [],
                    codecs: [],
                    availableBandwidth: 0,
                    streams: 0
                },
                recv: {
                    tracks: [],
                    codecs: [],
                    availableBandwidth: 0,
                    streams: 0
                },
                bytesSent: 0,
                bytesReceived: 0
            },
            results: {},
            connectionType: {
                systemNetworkType: systemNetworkType,
                systemIpAddress: '192.168.1.2',
                local: {
                    candidateType: [],
                    transport: [],
                    ipAddress: [],
                    networkType: []
                },
                remote: {
                    candidateType: [],
                    transport: [],
                    ipAddress: [],
                    networkType: []
                }
            },
            resolutions: {
                send: {
                    width: 0,
                    height: 0
                },
                recv: {
                    width: 0,
                    height: 0
                }
            },
            internal: {
                audio: {
                    send: {},
                    recv: {}
                },
                video: {
                    send: {},
                    recv: {}
                },
                candidates: {}
            },
            nomore: function () {
                nomore = true;
            }
        };
    }
    initStatsParser() {
        let that = this
        this.statsParser = {
            checkIfOfferer: function (result) {
                if (result.type === 'googLibjingleSession') {
                    that.statsResult.isOfferer = result.googInitiator;
                }
            }
        };
    }
    initStatsParserFn() {
        let {
            AUDIO_codecs,
            VIDEO_codecs,
            SSRC,
            statsParser,
            statsResult,
            LOCAL_candidateType,
            LOCAL_transport,
            LOCAL_ipAddress,
            LOCAL_networkType,
            REMOTE_candidateType,
            REMOTE_transport,
            REMOTE_ipAddress,
            REMOTE_networkType
        } = this

        statsParser.datachannel = function (result) {
            if (result.type !== 'datachannel') return;

            statsResult.datachannel = {
                state: result.state // open or connecting
            }
        };

        statsParser.googCertificate = function (result) {
            if (result.type == 'googCertificate') {
                statsResult.encryption = result.googFingerprintAlgorithm;
            }
        };


        statsParser.checkAudioTracks = function (result) {
            if (!result.googCodecName || result.mediaType !== 'audio') return;

            if (AUDIO_codecs.indexOf(result.googCodecName.toLowerCase()) === -1) return;

            var sendrecvType = result.id.split('_').pop();

            if (statsResult.audio[sendrecvType].codecs.indexOf(result.googCodecName) === -1) {
                statsResult.audio[sendrecvType].codecs.push(result.googCodecName);
            }

            if (result.bytesSent) {
                var kilobytes = 0;
                if (!!result.bytesSent) {
                    if (!statsResult.internal.audio[sendrecvType].prevBytesSent) {
                        statsResult.internal.audio[sendrecvType].prevBytesSent = result.bytesSent;
                    }

                    var bytes = result.bytesSent - statsResult.internal.audio[sendrecvType].prevBytesSent;
                    statsResult.internal.audio[sendrecvType].prevBytesSent = result.bytesSent;

                    kilobytes = bytes / 1024;
                }

                statsResult.audio[sendrecvType].availableBandwidth = kilobytes.toFixed(1);
            }

            if (result.bytesReceived) {
                var kilobytes = 0;
                if (!!result.bytesReceived) {
                    if (!statsResult.internal.audio[sendrecvType].prevBytesReceived) {
                        statsResult.internal.audio[sendrecvType].prevBytesReceived = result.bytesReceived;
                    }

                    var bytes = result.bytesReceived - statsResult.internal.audio[sendrecvType].prevBytesReceived;
                    statsResult.internal.audio[sendrecvType].prevBytesReceived = result.bytesReceived;

                    kilobytes = bytes / 1024;
                }

                statsResult.audio[sendrecvType].availableBandwidth = kilobytes.toFixed(1);
            }

            if (statsResult.audio[sendrecvType].tracks.indexOf(result.googTrackId) === -1) {
                statsResult.audio[sendrecvType].tracks.push(result.googTrackId);
            }
        };


        statsParser.checkVideoTracks = function (result) {
            if (!result.googCodecName || result.mediaType !== 'video') return;

            if (VIDEO_codecs.indexOf(result.googCodecName.toLowerCase()) === -1) return;

            // googCurrentDelayMs, googRenderDelayMs, googTargetDelayMs
            // transportId === 'Channel-audio-1'
            var sendrecvType = result.id.split('_').pop();

            if (statsResult.video[sendrecvType].codecs.indexOf(result.googCodecName) === -1) {
                statsResult.video[sendrecvType].codecs.push(result.googCodecName);
            }

            if (!!result.bytesSent) {
                var kilobytes = 0;
                if (!statsResult.internal.video[sendrecvType].prevBytesSent) {
                    statsResult.internal.video[sendrecvType].prevBytesSent = result.bytesSent;
                }

                var bytes = result.bytesSent - statsResult.internal.video[sendrecvType].prevBytesSent;
                statsResult.internal.video[sendrecvType].prevBytesSent = result.bytesSent;

                kilobytes = bytes / 1024;
            }

            if (!!result.bytesReceived) {
                var kilobytes = 0;
                if (!statsResult.internal.video[sendrecvType].prevBytesReceived) {
                    statsResult.internal.video[sendrecvType].prevBytesReceived = result.bytesReceived;
                }

                var bytes = result.bytesReceived - statsResult.internal.video[sendrecvType].prevBytesReceived;
                statsResult.internal.video[sendrecvType].prevBytesReceived = result.bytesReceived;

                kilobytes = bytes / 1024;
            }

            statsResult.video[sendrecvType].availableBandwidth = kilobytes.toFixed(1);

            if (result.googFrameHeightReceived && result.googFrameWidthReceived) {
                statsResult.resolutions[sendrecvType].width = result.googFrameWidthReceived;
                statsResult.resolutions[sendrecvType].height = result.googFrameHeightReceived;
            }

            if (result.googFrameHeightSent && result.googFrameWidthSent) {
                statsResult.resolutions[sendrecvType].width = result.googFrameWidthSent;
                statsResult.resolutions[sendrecvType].height = result.googFrameHeightSent;
            }

            if (statsResult.video[sendrecvType].tracks.indexOf(result.googTrackId) === -1) {
                statsResult.video[sendrecvType].tracks.push(result.googTrackId);
            }
        };

        statsParser.bweforvideo = function (result) {
            if (result.type !== 'VideoBwe') return;

            // id === 'bweforvideo'

            statsResult.video.bandwidth = {
                googActualEncBitrate: result.googActualEncBitrate,
                googAvailableSendBandwidth: result.googAvailableSendBandwidth,
                googAvailableReceiveBandwidth: result.googAvailableReceiveBandwidth,
                googRetransmitBitrate: result.googRetransmitBitrate,
                googTargetEncBitrate: result.googTargetEncBitrate,
                googBucketDelay: result.googBucketDelay,
                googTransmitBitrate: result.googTransmitBitrate
            };
        };

        statsParser.googCandidatePair = function (result) {
            if (result.type !== 'googCandidatePair') return;

            // result.googActiveConnection means either STUN or TURN is used.

            if (result.googActiveConnection == 'true') {
                // id === 'Conn-audio-1-0'
                // localCandidateId, remoteCandidateId

                // bytesSent, bytesReceived

                statsResult.connectionType.local.ipAddress = result.googLocalAddress;
                statsResult.connectionType.remote.ipAddress = result.googRemoteAddress;
                statsResult.connectionType.transport = result.googTransportType;

                var localCandidate = statsResult.internal.candidates[result.localCandidateId];
                if (localCandidate) {
                    if (localCandidate.ipAddress) {
                        statsResult.connectionType.systemIpAddress = localCandidate.ipAddress;
                    }
                }

                var remoteCandidate = statsResult.internal.candidates[result.remoteCandidateId];
                if (remoteCandidate) {
                    if (remoteCandidate.ipAddress) {
                        statsResult.connectionType.systemIpAddress = remoteCandidate.ipAddress;
                    }
                }
            }
        };

        statsParser.localcandidate = function (result) {
            // console.log(result)
            if (result.type !== 'localcandidate') return;

            if (result.candidateType && LOCAL_candidateType.indexOf(result.candidateType) === -1) {
                LOCAL_candidateType.push(result.candidateType);
            }

            if (result.transport && LOCAL_transport.indexOf(result.transport) === -1) {
                LOCAL_transport.push(result.transport);
            }

            if (result.ipAddress && LOCAL_ipAddress.indexOf(result.ipAddress + ':' + result.portNumber) === -1) {
                LOCAL_ipAddress.push(result.ipAddress + ':' + result.portNumber);
            }

            if (result.networkType && LOCAL_networkType.indexOf(result.networkType) === -1) {
                LOCAL_networkType.push(result.networkType);
            }

            statsResult.internal.candidates[result.id] = {
                candidateType: LOCAL_candidateType,
                ipAddress: LOCAL_ipAddress,
                portNumber: result.portNumber,
                networkType: LOCAL_networkType,
                priority: result.priority,
                transport: LOCAL_transport,
                timestamp: result.timestamp,
                id: result.id,
                type: result.type
            };

            statsResult.connectionType.local.candidateType = LOCAL_candidateType;
            statsResult.connectionType.local.ipAddress = LOCAL_ipAddress;
            statsResult.connectionType.local.networkType = LOCAL_networkType;
            statsResult.connectionType.local.transport = LOCAL_transport;
        };

        statsParser.remotecandidate = function (result) {
            if (result.type !== 'remotecandidate') return;

            if (result.candidateType && REMOTE_candidateType.indexOf(result.candidateType) === -1) {
                REMOTE_candidateType.push(result.candidateType);
            }

            if (result.transport && REMOTE_transport.indexOf(result.transport) === -1) {
                REMOTE_transport.push(result.transport);
            }

            if (result.ipAddress && REMOTE_ipAddress.indexOf(result.ipAddress + ':' + result.portNumber) === -1) {
                REMOTE_ipAddress.push(result.ipAddress + ':' + result.portNumber);
            }

            if (result.networkType && REMOTE_networkType.indexOf(result.networkType) === -1) {
                REMOTE_networkType.push(result.networkType);
            }

            statsResult.internal.candidates[result.id] = {
                candidateType: REMOTE_candidateType,
                ipAddress: REMOTE_ipAddress,
                portNumber: result.portNumber,
                networkType: REMOTE_networkType,
                priority: result.priority,
                transport: REMOTE_transport,
                timestamp: result.timestamp,
                id: result.id,
                type: result.type
            };

            statsResult.connectionType.remote.candidateType = REMOTE_candidateType;
            statsResult.connectionType.remote.ipAddress = REMOTE_ipAddress;
            statsResult.connectionType.remote.networkType = REMOTE_networkType;
            statsResult.connectionType.remote.transport = REMOTE_transport;
        };

        statsParser.dataSentReceived = function (result) {
            if (!result.googCodecName || (result.mediaType !== 'video' && result.mediaType !== 'audio')) return;

            if (!!result.bytesSent) {
                statsResult[result.mediaType].bytesSent = parseInt(result.bytesSent);
            }

            if (!!result.bytesReceived) {
                statsResult[result.mediaType].bytesReceived = parseInt(result.bytesReceived);
            }
        };

        statsParser.ssrc = function (result) {
            if (!result.googCodecName || (result.mediaType !== 'video' && result.mediaType !== 'audio')) return;
            if (result.type !== 'ssrc') return;
            var sendrecvType = result.id.split('_').pop();

            if (SSRC[result.mediaType][sendrecvType].indexOf(result.ssrc) === -1) {
                SSRC[result.mediaType][sendrecvType].push(result.ssrc)
            }

            statsResult[result.mediaType][sendrecvType].streams = SSRC[result.mediaType][sendrecvType].length;
        };
    }
    start(interval = this.interval) {
        if (this.statsTimer) {
            clearInterval(this.statsTimer)
        }
        this.interval = interval
        this.statsTimer = setInterval(this.getStats.bind(this), interval)
    }
    stop() {
        if (!this.statsTimer) {
            return
        }
        clearInterval(this.statsTimer)
        this.statsTimer = null
        this.reset()
    }
    // a wrapper around getStats which hides the differences (where possible)
    // following code-snippet is taken from somewhere on the github
    getStats() {
        let cb = this.formatResult.bind(this)
        let { peer, mediaStreamTrack } = this
        // if !peer or peer.signalingState == 'closed' then return;
        if (typeof window.InstallTrigger !== 'undefined') {
            peer.getStats(
                mediaStreamTrack,
                function (res) {
                    var items = [];
                    res.forEach(function (r) {
                        items.push(r);
                    });
                    cb(items);
                },
                cb
            );
        } else {
            peer.getStats(function (res) {
                var items = [];
                res.result().forEach(function (res) {
                    var item = {};
                    res.names().forEach(function (name) {
                        item[name] = res.stat(name);
                    });
                    item.id = res.id;
                    item.type = res.type;
                    item.timestamp = res.timestamp;
                    items.push(item);
                });
                cb(items);
            });
        }
    }
    formatResult(results) {
        let { peer, mediaStreamTrack, statsParser, statsResult } = this
        results.forEach((result) => {
            Object.keys(statsParser).forEach((key) => {
                if (typeof statsParser[key] === 'function') {
                    statsParser[key](result);
                }
            });
        });

        try {
            // failed|closed
            if (peer.iceConnectionState.search(/failed/gi) !== -1) {
                this.nomore = true;
            }
        } catch (e) {
            this.nomore = true;
        }

        if (this.nomore === true) {
            if (statsResult.datachannel) {
                statsResult.datachannel.state = 'close';
            }
            statsResult.ended = true;
        }

        // allow users to access native results
        statsResult.results = results;

        this.emit('stats', statsResult);

    }
}