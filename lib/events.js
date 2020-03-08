class Events {
    constructor(parent, reset) {
        this.valid = ['reading', 'writing', 'drained', 'next', 'source', 'success', 'fail', 'error', 'queueError', 'end', 'merged', 'writeEnd', 'readEnd'];
        this.reset = typeof reset === 'function' ? reset : () => {};
        this.calcs = {}
        this.counts = {};
        this.valid.forEach(ev => {
            this[ev] = [];
            this.calcs[ev] = null;
            this.counts[ev] = 0;
        }, this);
        this._defaultEvents(parent);
    }
    
    set merged(m) {
        if (!this._merged) {
            this._merged = [this.reset];
        } else {
            if (typeof m === 'function') {
                this._merged.unshift(m);
            }
        }
    }
    
    get merged() {
        return this._merged || [this.reset];
    }

    on(event, callback, calc) {
        if (typeof callback !== 'function') {
            return;
        }
        if (this.valid.includes(event) && typeof callback === 'function') {
            this[event].push(callback);
            if (calc || !this.calcs[event]) {
                this.calcs[event] = callback;
            }
        }
    }
    
    calc(event, ...args) {
        this.counts[event]++;
        let res = null;
        if (typeof this.calcs[event] === 'function') {
            res = this.calcs[event].call(this, ...args);
        }
       
        return res;
    }

    fire(event, ...args) {
        this.counts[event]++;
        if (this.valid.includes(event) && this[event].length) {
            this[event].forEach(ev => {
                ev.call(this, ...args)
            }, this);
        }
        return this;
    }
    
    _defaultEvents(parent) {
        let $this = parent;
        this.on('merged', (loc) => {
            let msg = 'Data written to ' + loc;
            if ($this.writable.length) {
                console.error('Data Failed to write for sources: ' + $this.writableSources.join(', '));
                msg = msg.replace('Data', 'Remaining data');
            }
            console.log(msg);
        });
        this.on('error', (...args) => { 
            $this.end().reset().err(...args);
         });  
         
        this.on('source', (src) => {
            if ($this.writeActive) {
               $this.write.source = src;
            } 
            if ($this.writeObjectActive) {
               $this.writeObject.source = src;
            }
        });
        
        this.on('next', () => {
            if ($this.gen) {
                let d = $this.gen.next().value;
                if (d) {
                    $this.flow(d);
                } else {
                    $this.end();
                }
            }
        });
        
        this.on('success', function(chunk, source) {
            $this.logWritten(source);
            $this.currentSrc = null;
        });
    }
}

module.exports = Events;