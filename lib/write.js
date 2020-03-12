const config = require('./config');
const fs = require('fs');
const mini = require('terser');
const { Writable } = require('stream');

module.exports = class {
    constructor() {
       
        this.onData = this._defaultData();
        this.timer = null;
        this.minified = false;
    }
    
    reset() {
        if (this.stream) {
            this.stream.end;
        }
        this.minified = false;
        this.timer = null;
    }
    
    stream(dest, length, min, timeout) {
        if (dest) {
            this.dest = dest;
        }
        if (typeof min == 'boolean') {
            this.min = min;
        }
        if (timeout > 0) {
            this.timeout = timeout;
        }
        if (this._stream) {
            this._stream.end();
        }
        let stream = new Writable({
            objectMode:true,
            write: this.write(dest, length,  min, timeout),
        });
        stream.on('error', (err, out, errMsg) => {
            if (err || errMsg) {
                return config.events.fire('error', 'Write Stream Error', err, errMsg);
            }
            if (out) {
                console.log(out);
            }
        });
        stream.path = $this.dest;
        this._stream = stream;
        return stream;
    }
    
    isLast(len) {
        return len && len > 0 ? config.events.counts.writeEnd == len : true;
    }
    
    write(dest, length, min, timeout) {
        let $this = this;
        return function(chunk, encoding, callback) {
            chunk = $this.onData(chunk);
            let outcome = null;
            if (timeout && timeout > 0) {
                $this.timer = setTimeout(() => {
                    config.events.fire('error', 'Event timed out: ' + $this.dest + ' took too long to respond'); 
                 }, timeout);
            }
            try {
                fs.appendFile($this.dest, chunk, (err, out, e) => {
                    if (out) {
                        console.log(out);
                    }
                    if (err || e) {
                        $this.onFail.call($this, chunk, err, e);
                    } else {
                        if ($this.timer) {
                            clearTimeout($this.timer);
                        }
                        config.events.fire('success', chunk, dest);
                    }
                    config.events.fire('writeEnd', dest);
                    if ($this.isLast(length)) {
                        if (min) {
                            $this.minify();
                        } else {
                            config.events.fire('merged', dest);
                        }
                    }
                });
            } catch(e) {
                $this.onFail.call($this, chunk, e);
                outcome = e;
            } finally {
                callback(outcome);
            }
        }
    }
    
    onWritten(success, min, chunk, dest, ...args) {
        let $this = this;
        if (success) {
            if ($this.timer) {
                clearTimeout($this.timer);
            }
            config.events.fire('success', chunk, dest);
        } else {
            $this.onFail.call($this, chunk, ...args);
        }
        config.events.fire('writeEnd', dest);
        if ($this.isLast(length)) {
            if (min) {
                $this.minify();
            } else {
                config.events.fire('merged', dest);
            }
        }
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
    }
    
    minify(dest, ext) {
        let $this = this;
        if (!this.minified) {
            let minPath = dest.replace('.' + ext, '.min.' + ext);
            fs.readFile(minPath, 'utf-8', (err, file) => {
                if (err) {
                    config.events.fire('minifyError', 'Minify Read Error', err);
                }
                let mi = {};
                try {
                    mi = mini.minify(file);
                } catch(e) {
                    config.events.fire('minifyError', 'Terser Error', e);
                }
                if (mi.error) {
                    config.events.fire('minifyError', 'Minify Error', mi.error);
                }
                fs.writeFile(minPath, mi.code, 'utf-8', (err, out, errMsg) => {
                    if (err || errMsg) {
                        return config.events.fire('minifyError', 'Minify Write Error', err, errMsg);
                    }
                    if (out) {
                        console.log(out);
                    }
                    config.events.fire('merged', dest);
                    $this.minified = true;
                });
            });
        }
        return this;
    }
    
    set timeout(t) {
        t = parseInt(t);
        if (t > 0) {
            this._timeout = t > 1000 ? t/1000 : t;   
        } else {
            this._timeout = null;
        }
    }
    
    get timeout() {
        let t = this._timeout || null;
        return t < 1000 ? t*1000 : t;   

    }
    
    onFail(chunk, ...errs) {
        let f = this.parent.config.events.calc('fail', chunk, this.dest);
        if (f) {
            console.log('Write Error', ...errs);
        } else {
            throw new Error('Write Error', ...errs);
        }
    }
    
    _defaultData() {
        return function(data) {
            return data;
        }
    }
}