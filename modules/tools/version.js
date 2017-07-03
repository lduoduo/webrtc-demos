/** middleware for version log of server */
'use strict';

module.exports = function(version){

    return function* (next){
        this.set('x-web-version',version);
        yield next;
    }

}