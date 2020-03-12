
const config = require('./config');

module.exports = class {
    constructor(src, data) {
        this.data = data;
        this.source = src;
        this.drained = false;
        
        let $this = this;
        config.events.on('drained', function(src) {
            if (src == $this.source) {
                $this.drained = true;
            }
        });
        
        config.events.on('success', function(chunk, src)  {
            if (src == $this.source) {
                if ($this.drained) {
                    config.events.fire('next');
                } else {
                    config.events.on('drained', function(src) {
                        if (src == $this.source) {
                            config.events.fire('next');
                        }
                    });
                }
            }
        });
    }
}