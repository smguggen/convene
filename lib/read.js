const { Readable } = require('stream');
const fs = require('fs');
module.exports = class {
    constructor(events) {
        this.events = events;
        this._queue = {};
        this.onData = this._defaultData();

    }
    
    get length() {
        return this.sources.length;
    }
    
    get queue() {
        return Object.values(this._queue || {});
    }
    
    get sources() {
        return Object.keys(this._queue || {});
    }
    
    flush(key) {
        if (key && this._queue.hasOwnProperty(key)) {
            delete this._queue[key];
        } else {
            this._queue = {};
        }
    }

    enqueue(s, callback) {
        let $this = this;
        if (Array.isArray(s)) {
            s.forEach(src => { $this._enqueue(src, callback) });
        } else {
            this._enqueue(s, callback);
        }
        return this;
    }
    
    require(src) {
        let $this = this;
        try {
            return require(src);
        } catch(e) {
            $this.events.fire('error', 'Module not found. Please check path ' + src, e);
            return null;
        }
    }
    
    file(encoding) {
        return function(src) {
            return this.getReader(src, encoding);
        }
    }
    
    getReader(src, encoding) {
        encoding = encoding || 'utf-8';
        let $this = this;
        let options = {
            read: function(size) {
                let res = $this.onData(src, size);
                res = res ? res : src;
                if ($this.isReadable(res)) {
                    let d;
                    do {
                        d = this.push(res, encoding);
                    } while(d);
                    this.push(null);
                } else {
                    $this.err('Source not readable');
                }
            } 
        }
        let r = new Readable(options);
        r.setEncoding(encoding);
        r.on('error', (err, out, errMsg) => {
            if (err || errMsg) {
                return $this.events.fire('error', 'Read Stream Error', err, errMsg);
            }
            if (out) {
                console.log(out);
            }
        });
        return r;
    }
    
    isReadable(src) {
        return typeof src === 'string' ||
            src instanceof Buffer ||
            src instanceof Uint8Array
    }
    
    transform(callback) {
        let $this = this;
        this.onData = function(data) {
            if (typeof callback === 'function') {
                return callback.call($this, data);
            } else {
                return data;
            }
        }
        return this;
    }
    
    _enqueue(s, callback) {
        let key = typeof s !== 'string' || 
        s <= this.length || 
        s.length > 1000 ?
        this.length + 1 :
        s;
        let $this = this;
        if (typeof callback == 'string' && typeof $this[callback] === 'function') {
            callback = $this[callback];
        }
        let fn = typeof callback === 'function' ? callback : this._defaultQueue();
        let res = () => fn.call($this, s);
        this._queue[key] = res;
    }
    
    _defaultQueue() {
        return function(src) {
            return src;
        }
    }
    
    _defaultData() {
        return function(data) {
            return data;
        }
    }

}