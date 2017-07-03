
class GainController {
    constructor(stream) {
        // super()
        this.gain = 1;

        var context = this.context = new AudioContext();
        this.uid = 0;

        this.microphone = context.createMediaStreamSource(stream);
        this.gainFilter = context.createGain();
        this.destination = context.createMediaStreamDestination();
        this.outputStream = this.destination.stream;

        this.initMonitor();

        this.microphone.connect(this.script);
        this.microphone.connect(this.gainFilter);
        this.script.connect(this.gainFilter);
        this.gainFilter.connect(this.destination);

        // this.startMonitor();

        // stream.removeTrack(stream.getAudioTracks()[0]);
        // stream.addTrack(this.outputStream.getAudioTracks()[0]);

        this.stream = stream;
    }
}


const fn = GainController.prototype;

// setting
fn.setGain = function (val) {
    // check for support
    if (!this.support) return;
    this.gainFilter.gain.value = val;
    this.gain = val;
};

fn.getGain = function () {
    return this.gain;
};

fn.off = function () {
    return this.setGain(0);
};

fn.on = function () {
    this.setGain(1);
};

fn.destroy = function () {
    this.instant = 0.0;
    this.slow = 0.0;
    this.clip = 0.0;

    this.microphone.disconnect();
    this.gainFilter.disconnect();
    this.script.disconnect();

    this.context.close();
    let ms = this.stream
    let outms = this.outputStream

    dropMS(ms);
    dropMS(outms);

    function dropMS(mms) {
        mms.getTracks().forEach(function (track) {
            track.stop()
            mms.removeTrack(track)
        })
    }

    this.stream = null
    this.outputStream = null
};

fn.initMonitor = function () {
    var that = this;
    this.instant = 0.0;
    this.slow = 0.0;
    this.clip = 0.0;
    var scriptNode = this.script = this.context.createScriptProcessor(0, 1, 1);
    console.log(scriptNode.bufferSize);

    // test, 只循环20次
    let count = 0
    scriptNode.onaudioprocess = function (audioProcessingEvent) {
        var input = audioProcessingEvent.inputBuffer.getChannelData(0);
        var i;
        var sum = 0.0;
        var clipcount = 0;
        for (i = 0; i < input.length; ++i) {
            sum += input[i] * input[i];
            if (Math.abs(input[i]) > 0.99) {
                clipcount += 1;
            }
        }
        that.instant = Math.sqrt(sum / input.length);
        that.slow = 0.95 * that.slow + 0.05 * that.instant;
        that.clip = clipcount / input.length;

        // if (count <= 20) {
        //     count++
        //     console.log({
        //         instant: that.instant,
        //         slow: that.slow,
        //         clip: that.clip
        //     })
        // }
    };

}

fn.getVolumeData = function () {
    return {
        instant: this.instant.toFixed(5),
        slow: this.slow.toFixed(5),
        clip: this.clip.toFixed(5)
    }
}

// module.exports = GainController;
// export default GainController;
