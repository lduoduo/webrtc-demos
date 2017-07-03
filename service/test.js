/** service logic control of page test */
'use strict';

var view  = require('../modules/render/bigpipe/bp');
var config = require('../config');

module.exports = {
    index: function* (next){

        /** init render js */
        this.body = new view('test',this);

        /** init page settings */
        this.body.page('testa',{
            title: 'test bigpipe'
        });

        /** add components */
        this.body.add('a');
        this.body.add('b');
        this.body.add('c');
        this.body.add('d',config.interUrl + "list/getlist");

        yield this.body.render();

    }
}