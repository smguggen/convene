const { Readable } = require('stream');
const config = require('./config');

module.exports = class {
    constructor() {
        this.queue = {};
        this.onData = this._defaultData();

    }
    
    get length() {
        return this.sources.length;
    }
    
    set queue(q) {
        if (typeof q !== 'function') {
            return;
        }
        let oldQ = this._queue || {};
        let _queue = q;
        if (!this._queue || typeof this._queue !== 'object') {
            _queue = oldQ;
        }
    }
    
    get queue() {
        return Object.values(this._queue || {});
    }
    
    get sources() {
        return Object.keys(this._queue || {});
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
    
    require() {
        return function(src) {
            try {
                return require(src);
            } catch(e) {
                return null;
            }
        }
    }
    
    json() {
        return function(src) {
            src = src.replace('.json', '');
            try {
                return require(src  + '.json');
            } catch(e) {
                return null;
            }
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
                return config.events.fire('error', 'Read Stream Error', err, errMsg);
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
        s.length > 50 ?
        this.length + 1 :
        s;
        let $this = this;
        if (typeof callback == 'string' && typeof $this[callback] === 'function') {
            callback = $this[callback];
        }
        let fn = typeof callback === 'function' ? callback : this._defaultQueue();
        let res = () => fn.call($this, s);
        this.queue[key] = res;
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