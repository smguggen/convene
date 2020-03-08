class Events {
    constructor(parent) {
        this.valid = ['reading', 'writing', 'drained', 'next', 'source', 'success', 'fail', 'error', 'queueError', 'end', 'readEnd'];
        this.calcs = {}
        this.counts = {};
        this.valid.forEach(ev => {
            this[ev] = [];
            this.calcs[ev] = null;
            this.counts[ev] = 0;
        }, this);
        this._defaultEvents(parent);
    }

    on(event, callback, calc) {
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
        this.on('end', (loc) => {
            let msg = 'Data written to ' + loc;
            if ($this.writable.length) {
                console.error('Data Failed to write for sources ' + $this.writableSources.join(', '));
                msg = msg.replace('Data', 'Remaining data');
            }
            console.log(msg);
        });
        this.on('error', (...args) => { 
            $this.end();
            $this.err(...args);
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
        
        this.on('success', (chunk, source) => {
            $this.logWritten(source);
            $this.currentSrc = null;
        });
    }
}

module.exports = Events;