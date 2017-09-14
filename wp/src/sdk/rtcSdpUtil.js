// rtc sdp协议修改

/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */
// 注：依赖Platform.js

'use strict';

module.exports = {
    /**
   * get random ssrc value
   * 目前没有用到
   */
    randomSSRC() {
        let ram = Math.floor(Math.random() * 100000000) + 10000000
        return ram > 100000000 ? 99999999 : ram
    },
    randomCname() {
        let tmp = 'ABCDEFGHIGKLMNOPQRSTUVWXYZ'
        let ram = Math.floor(Math.random() * 100000000) + 10000000
        ram = ram > 100000000 ? 99999999 + '' : ram + ''

        var map = Array.prototype.map
        ram = Array.prototype.map.call(ram, (x) => {
            return tmp[x] + x + tmp[+x + 5]
        })
        return ram.join('')
    },
    mergeConstraints(cons1, cons2) {
        if (!cons1 || !cons2) {
            return cons1 || cons2;
        }
        var merged = cons1;
        for (var key in cons2) {
            merged[key] = cons2[key];
        }
        return merged;
    },
    iceCandidateType(candidateStr) {
        return candidateStr.split(' ')[7];
    },
    // Turns the local type preference into a human-readable string.
    // Note that this mapping is browser-specific.
    formatTypePreference(pref) {
        if (platform.name === 'Chrome') {
            switch (pref) {
                case 0:
                    return 'TURN/TLS';
                case 1:
                    return 'TURN/TCP';
                case 2:
                    return 'TURN/UDP';
                default:
                    break;
            }
        } else if (platform.name === 'Firefox') {
            switch (pref) {
                case 0:
                    return 'TURN/TCP';
                case 5:
                    return 'TURN/UDP';
                default:
                    break;
            }
        }
        return '';
    },

    maybeSetOpusOptions(sdp, params) {
        // Set Opus in Stereo, if stereo is true, unset it, if stereo is false, and
        // do nothing if otherwise.
        if (params.opusStereo === 'true') {
            sdp = this.setCodecParam(sdp, 'opus/48000', 'stereo', '1');
        } else if (params.opusStereo === 'false') {
            sdp = this.removeCodecParam(sdp, 'opus/48000', 'stereo');
        }

        // Set Opus FEC, if opusfec is true, unset it, if opusfec is false, and
        // do nothing if otherwise.
        if (params.opusFec === 'true') {
            sdp = this.setCodecParam(sdp, 'opus/48000', 'useinbandfec', '1');
        } else if (params.opusFec === 'false') {
            sdp = this.removeCodecParam(sdp, 'opus/48000', 'useinbandfec');
        }

        // Set Opus DTX, if opusdtx is true, unset it, if opusdtx is false, and
        // do nothing if otherwise.
        if (params.opusDtx === 'true') {
            sdp = this.setCodecParam(sdp, 'opus/48000', 'usedtx', '1');
        } else if (params.opusDtx === 'false') {
            sdp = this.removeCodecParam(sdp, 'opus/48000', 'usedtx');
        }

        // Set Opus maxplaybackrate, if requested.
        if (params.opusMaxPbr) {
            sdp = this.setCodecParam(sdp, 'opus/48000', 'maxplaybackrate', params.opusMaxPbr);
        }
        return sdp;
    },

    maybeSetAudioSendBitRate(sdp, params) {
        if (!params.audioSendBitrate) {
            return sdp;
        }
        console.log('Prefer audio send bitrate: ' + params.audioSendBitrate);
        return this.preferBitRate(sdp, params.audioSendBitrate, 'audio');
    },


    maybeSetAudioReceiveBitRate(sdp, params) {
        if (!params.audioRecvBitrate) {
            return sdp;
        }
        console.log('Prefer audio receive bitrate: ' + params.audioRecvBitrate);
        return this.preferBitRate(sdp, params.audioRecvBitrate, 'audio');
    },

    maybeSetVideoSendBitRate(sdp, params) {
        if (!params.videoSendBitrate) {
            return sdp;
        }
        console.log('Prefer video send bitrate: ' + params.videoSendBitrate);
        return this.preferBitRate(sdp, params.videoSendBitrate, 'video');
    },

    maybeSetVideoReceiveBitRate(sdp, params) {
        if (!params.videoRecvBitrate) {
            return sdp;
        }
        console.log('Prefer video receive bitrate: ' + params.videoRecvBitrate);
        return this.preferBitRate(sdp, params.videoRecvBitrate, 'video');
    },

    // Add a b=AS:bitrate line to the m=mediaType section.
    preferBitRate(sdp, bitrate, mediaType) {
        var sdpLines = sdp.split('\r\n');

        // Find m line for the given mediaType.
        var mLineIndex = this.findLine(sdpLines, 'm=', mediaType);
        if (mLineIndex === null) {
            console.log('Failed to add bandwidth line to sdp, as no m-line found');
            return sdp;
        }

        // Find next m-line if any.
        var nextMLineIndex = this.findLineInRange(sdpLines, mLineIndex + 1, -1, 'm=');
        if (nextMLineIndex === null) {
            nextMLineIndex = sdpLines.length;
        }

        // Find c-line corresponding to the m-line.
        var cLineIndex = this.findLineInRange(sdpLines, mLineIndex + 1,
            nextMLineIndex, 'c=');
        if (cLineIndex === null) {
            console.log('Failed to add bandwidth line to sdp, as no c-line found');
            return sdp;
        }

        // Check if bandwidth line already exists between c-line and next m-line.
        var bLineIndex = this.findLineInRange(sdpLines, cLineIndex + 1,
            nextMLineIndex, 'b=AS');
        if (bLineIndex) {
            sdpLines.splice(bLineIndex, 1);
        }

        // Create the b (bandwidth) sdp line.
        var bwLine = 'b=AS:' + bitrate;
        // As per RFC 4566, the b line should follow after c-line.
        sdpLines.splice(cLineIndex + 1, 0, bwLine);
        sdp = sdpLines.join('\r\n');
        return sdp;
    },

    // Add an a=fmtp: x-google-min-bitrate=kbps line, if videoSendInitialBitrate
    // is specified. We'll also add a x-google-min-bitrate value, since the max
    // must be >= the min.
    maybeSetVideoSendInitialBitRate(sdp, params) {
        var initialBitrate = params.videoSendInitialBitrate;
        if (!initialBitrate) {
            return sdp;
        }

        // Validate the initial bitrate value.
        var maxBitrate = initialBitrate;
        var bitrate = params.videoSendBitrate;
        if (bitrate) {
            if (initialBitrate > bitrate) {
                console.log('Clamping initial bitrate to max bitrate of ' +
                    bitrate + ' kbps.');
                initialBitrate = bitrate;
                params.videoSendInitialBitrate = initialBitrate;
            }
            maxBitrate = bitrate;
        }

        var sdpLines = sdp.split('\r\n');

        // Search for m line.
        var mLineIndex = findLine(sdpLines, 'm=', 'video');
        if (mLineIndex === null) {
            console.log('Failed to find video m-line');
            return sdp;
        }

        var codec = params.videoRecvCodec;
        sdp = this.setCodecParam(sdp, codec, 'x-google-min-bitrate',
            params.videoSendInitialBitrate.toString());
        sdp = this.setCodecParam(sdp, codec, 'x-google-max-bitrate',
            maxBitrate.toString());

        return sdp;
    },

    removePayloadTypeFromMline(mLine, payloadType) {
        mLine = mLine.split(' ');
        for (var i = 0; i < mLine.length; ++i) {
            if (mLine[i] === payloadType.toString()) {
                mLine.splice(i, 1);
            }
        }
        return mLine.join(' ');
    },

    removeCodecByName(sdpLines, codec) {
        var index = this.findLine(sdpLines, 'a=rtpmap', codec);
        if (index === null) {
            return sdpLines;
        }
        var payloadType = this.getCodecPayloadTypeFromLine(sdpLines[index]);
        sdpLines.splice(index, 1);

        // Search for the video m= line and remove the codec.
        var mLineIndex = this.findLine(sdpLines, 'm=', 'video');
        if (mLineIndex === null) {
            return sdpLines;
        }
        sdpLines[mLineIndex] = this.removePayloadTypeFromMline(sdpLines[mLineIndex],
            payloadType);
        return sdpLines;
    },

    removeCodecByPayloadType(sdpLines, payloadType) {
        var index = this.findLine(sdpLines, 'a=rtpmap', payloadType.toString());
        if (index === null) {
            return sdpLines;
        }
        sdpLines.splice(index, 1);

        // Search for the video m= line and remove the codec.
        var mLineIndex = this.findLine(sdpLines, 'm=', 'video');
        if (mLineIndex === null) {
            return sdpLines;
        }
        sdpLines[mLineIndex] = this.removePayloadTypeFromMline(sdpLines[mLineIndex],
            payloadType);
        return sdpLines;
    },
    maybeRemoveVideoFec(sdp, params) {
        if (params.videoFec !== 'false') {
            return sdp;
        }

        var sdpLines = sdp.split('\r\n');

        var index = this.findLine(sdpLines, 'a=rtpmap', 'red');
        if (index === null) {
            return sdp;
        }
        var redPayloadType = this.getCodecPayloadTypeFromLine(sdpLines[index]);
        sdpLines = this.removeCodecByPayloadType(sdpLines, redPayloadType);

        sdpLines = this.removeCodecByName(sdpLines, 'ulpfec');

        // Remove fmtp lines associated with red codec.
        index = this.findLine(sdpLines, 'a=fmtp', redPayloadType.toString());
        if (index === null) {
            return sdp;
        }
        var fmtpLine = this.parseFmtpLine(sdpLines[index]);
        var rtxPayloadType = fmtpLine.pt;
        if (rtxPayloadType === null) {
            return sdp;
        }
        sdpLines.splice(index, 1);

        sdpLines = this.removeCodecByPayloadType(sdpLines, rtxPayloadType);
        return sdpLines.join('\r\n');
    },

    // Promotes |audioSendCodec| to be the first in the m=audio line, if set.
    maybePreferAudioSendCodec(sdp, params) {
        return this.maybePreferCodec(sdp, 'audio', 'send', params.audioSendCodec);
    },
    // Promotes |audioRecvCodec| to be the first in the m=audio line, if set.
    maybePreferAudioReceiveCodec(sdp, params) {
        return this.maybePreferCodec(sdp, 'audio', 'receive', params.audioRecvCodec);
    },

    // Promotes |videoSendCodec| to be the first in the m=audio line, if set.
    maybePreferVideoSendCodec(sdp, params) {
        return this.maybePreferCodec(sdp, 'video', 'send', params.videoSendCodec);
    },

    // Promotes |videoRecvCodec| to be the first in the m=audio line, if set.
    maybePreferVideoReceiveCodec(sdp, params) {
        return this.maybePreferCodec(sdp, 'video', 'receive', params.videoRecvCodec);
    },

    // Sets |codec| as the default |type| codec if it's present.
    // The format of |codec| is 'NAME/RATE', e.g. 'opus/48000'.
    maybePreferCodec(sdp, type, dir, codec) {
        var str = type + ' ' + dir + ' codec';
        if (!codec) {
            console.log('No preference on ' + str + '.');
            return sdp;
        }

        console.log('Prefer ' + str + ': ' + codec);

        var sdpLines = sdp.split('\r\n');

        // Search for m line.
        var mLineIndex = this.findLine(sdpLines, 'm=', type);
        if (mLineIndex === null) {
            return sdp;
        }

        // If the codec is available, set it as the default in m line.
        var payload = this.getCodecPayloadType(sdpLines, codec);
        if (payload) {
            sdpLines[mLineIndex] = this.setDefaultCodec(sdpLines[mLineIndex], payload);
        }

        sdp = sdpLines.join('\r\n');
        return sdp;
    },

    // Set fmtp param to specific codec in SDP. If param does not exists, add it.
    setCodecParam(sdp, codec, param, value) {
        var sdpLines = sdp.split('\r\n');

        var fmtpLineIndex = this.findFmtpLine(sdpLines, codec);

        var fmtpObj = {};
        if (fmtpLineIndex === null) {
            var index = this.findLine(sdpLines, 'a=rtpmap', codec);
            if (index === null) {
                return sdp;
            }
            var payload = this.getCodecPayloadTypeFromLine(sdpLines[index]);
            fmtpObj.pt = payload.toString();
            fmtpObj.params = {};
            fmtpObj.params[param] = value;
            sdpLines.splice(index + 1, 0, this.writeFmtpLine(fmtpObj));
        } else {
            fmtpObj = this.parseFmtpLine(sdpLines[fmtpLineIndex]);
            fmtpObj.params[param] = value;
            sdpLines[fmtpLineIndex] = this.writeFmtpLine(fmtpObj);
        }

        sdp = sdpLines.join('\r\n');
        return sdp;
    },


    // Remove fmtp param if it exists.
    removeCodecParam(sdp, codec, param) {
        var sdpLines = sdp.split('\r\n');

        var fmtpLineIndex = this.findFmtpLine(sdpLines, codec);
        if (fmtpLineIndex === null) {
            return sdp;
        }

        var map = this.parseFmtpLine(sdpLines[fmtpLineIndex]);
        delete map.params[param];

        var newLine = this.writeFmtpLine(map);
        if (newLine === null) {
            sdpLines.splice(fmtpLineIndex, 1);
        } else {
            sdpLines[fmtpLineIndex] = newLine;
        }

        sdp = sdpLines.join('\r\n');
        return sdp;
    },


    // Split an fmtp line into an object including 'pt' and 'params'.
    parseFmtpLine(fmtpLine) {
        var fmtpObj = {};
        var spacePos = fmtpLine.indexOf(' ');
        var keyValues = fmtpLine.substring(spacePos + 1).split('; ');

        var pattern = new RegExp('a=fmtp:(\\d+)');
        var result = fmtpLine.match(pattern);
        if (result && result.length === 2) {
            fmtpObj.pt = result[1];
        } else {
            return null;
        }

        var params = {};
        for (var i = 0; i < keyValues.length; ++i) {
            var pair = keyValues[i].split('=');
            if (pair.length === 2) {
                params[pair[0]] = pair[1];
            }
        }
        fmtpObj.params = params;

        return fmtpObj;
    },

    // Generate an fmtp line from an object including 'pt' and 'params'.
    writeFmtpLine(fmtpObj) {
        if (!fmtpObj.hasOwnProperty('pt') || !fmtpObj.hasOwnProperty('params')) {
            return null;
        }
        var pt = fmtpObj.pt;
        var params = fmtpObj.params;
        var keyValues = [];
        var i = 0;
        for (var key in params) {
            keyValues[i] = key + '=' + params[key];
            ++i;
        }
        if (i === 0) {
            return null;
        }
        return 'a=fmtp:' + pt.toString() + ' ' + keyValues.join('; ');
    },

    // Find fmtp attribute for |codec| in |sdpLines|.
    findFmtpLine(sdpLines, codec) {
        // Find payload of codec.
        var payload = this.getCodecPayloadType(sdpLines, codec);
        // Find the payload in fmtp line.
        return payload ? this.findLine(sdpLines, 'a=fmtp:' + payload.toString()) : null;
    },

    // Find the line in sdpLines that starts with |prefix|, and, if specified,
    // contains |substr| (case-insensitive search).
    findLine(sdpLines, prefix, substr) {
        return this.findLineInRange(sdpLines, 0, -1, prefix, substr);
    },

    // Find the line in sdpLines[startLine...endLine - 1] that starts with |prefix|
    // and, if specified, contains |substr| (case-insensitive search).
    findLineInRange(sdpLines, startLine, endLine, prefix, substr) {
        var realEndLine = endLine !== -1 ? endLine : sdpLines.length;
        for (var i = startLine; i < realEndLine; ++i) {
            if (sdpLines[i].indexOf(prefix) === 0) {
                if (!substr ||
                    sdpLines[i].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
                    return i;
                }
            }
        }
        return null;
    },

    // Gets the codec payload type from sdp lines.
    getCodecPayloadType(sdpLines, codec) {
        var index = this.findLine(sdpLines, 'a=rtpmap', codec);
        return index ? this.getCodecPayloadTypeFromLine(sdpLines[index]) : null;
    },

    // Gets the codec payload type from an a=rtpmap:X line.
    getCodecPayloadTypeFromLine(sdpLine) {
        var pattern = new RegExp('a=rtpmap:(\\d+) [a-zA-Z0-9-]+\\/\\d+');
        var result = sdpLine.match(pattern);
        return (result && result.length === 2) ? result[1] : null;
    },

    // Returns a new m= line with the specified codec as the first one.
    setDefaultCodec(mLine, payload) {
        var elements = mLine.split(' ');

        // Just copy the first three parameters; codec order starts on fourth.
        var newLine = elements.slice(0, 3);

        // Put target payload first and copy in the rest.
        newLine.push(payload);
        for (var i = 3; i < elements.length; i++) {
            if (elements[i] !== payload) {
                newLine.push(elements[i]);
            }
        }
        return newLine.join(' ');
    }

}




















