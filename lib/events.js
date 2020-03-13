class Events {
    constructor(reset) {
        this.valid = ['reading', 'writing', 'drained', 'next', 'source', 'success', 'fail', 'error', 'queueError', 'minifyError', 'end', 'merged', 'writeEnd', 'readEnd'];
        this.reset = typeof reset === 'function' ? reset : () => {};
        this.calcs = {}
        this.counts = {};
        this.valid.forEach(ev => {
            this[ev] = [];
            this.calcs[ev] = null;
            this.counts[ev] = 0;
        }, this);
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
}

module.exports = Events;