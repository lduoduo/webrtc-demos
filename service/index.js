/** service entry */
'use strict';

module.exports = {
    test: require('./test'),
    data: require('./data'),
    '404':require('./404'),
    '500':require('./500'),
    home: require('./home'),
    webrtc: require('./p_webrtc'),
    desktop: require('./p_desktop'),
    rtcdata: require('./p_rtcdata'),
    file: require('./p_file'),
    message: require('./p_message'),
    chat: require('./p_chat')
}