
//const config = require('./config');

module.exports = class {
    constructor(src, data, events) {
        this.data = data;
        this.source = src;
        this.drained = false;
        this.events = events
        let $this = this;
        this.events.on('drained', function(src) {
            if (src == $this.source) {
                $this.drained = true;
            }
        });
        
        this.events.on('success', function(chunk, dest, src)  {
            if (src == $this.source) {
                if ($this.drained) {
                    $this.events.fire('next', src);
                } else {
                    $this.events.on('drained', function(src) {
                        if (src == $this.source) {
                            $this.events.fire('next', src);
                        }
                    });
                }
            }
        });
    }
}