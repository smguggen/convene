module.exports = class {
    constructor(parent, src, data) {
        this.states = ['queued', 'reading', 'writing', 'error', 'done'];
        this.data = data;
        this.source = src;
        this.parent = parent;
        let $this = this;
        this.drained = false;

        parent.events.on('reading', function() {
            if (parent.currentSrc == $this.source) {
                $this.state = 'reading';
            }
        });
        parent.events.on('writing', function() {
            if (parent.currentSrc == $this.source) {
                $this.state = 'writing';
            }
        });
        parent.events.on('error', function() {
            if (parent.currentSrc == $this.source) {
                $this.state = 'error';
                parent.currentSrc = null;
            }
        });
        parent.events.on('drained', function(src) {
            if (src == $this.source) {
                $this.drained = true;
            }
        });
        
        parent.events.on('success', function(chunk, src)  {
            if (src == $this.source) {
                if ($this.drained) {
                    $this.state = 'done';
                    parent.events.fire('next');
                } else {
                    parent.events.on('drained', function(src) {
                        if (src == $this.source) {
                            $this.state = 'done';
                            parent.events.fire('next');
                        }
                    });
                }
            }
        });
    }
    
    set state(st) {
        if (this.states.includes(st)) {
            this._state = st;
        }
    }
    
    get state() {
        return this._state || 'queued';
    }
}