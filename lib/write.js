const fs = require('fs');
const mini = require('terser');
const { Writable, Readable } = require('stream');

module.exports = class {
    constructor(events) {
        this.events = events;
        this.onData = this._defaultData();
        this.timer = null;
        this.minified = false;
        this.events.on('readEnd', (cb, outcome) => {
           cb(outcome); 
        });
    }
    
    reset() {
        if (this.stream) {
            this.stream.end;
        }
        this.minified = false;
        this.timer = null;
    }
    
    stream(dest, length, min, timeout) {
        let $this = this;
        timeout = timeout || 30000;
        if (this._stream) {
            this._stream.end();
        }
        let stream = new Writable({
            objectMode:true,
            write: this.write(dest, length,  min, timeout),
        });
        stream.on('error', (err, out, errMsg) => {
            if (err || errMsg) {
                return $this.events.fire('error', 'Write Stream Error', err, errMsg);
            }
            if (out) {
                console.log(out);
            }
        });
        stream.path = dest;
        this._stream = stream;
        return stream;
    }
    
    isLast(len) {
        if (typeof len === 'boolean') {
            return len;
        }
        return len && len > 0 ? this.events.counts.writeEnd == len : true;
    }
    
    write(dest, length, min, timeout) {
        let $this = this;
        return function(chunk, encoding, callback) {
            let outcome = null;
           
            if (timeout && timeout > 0) {
                $this.timer = setTimeout(() => {
                    $this.events.fire('error', 'Event timed out: ' + dest + ' took too long to respond'); 
                 }, timeout);
            }
            chunk = $this.onData(chunk);
            console.log(dest);
            if (chunk instanceof Readable) {
                $this.pipe(chunk, callback, dest, length, min, timeout);
            } else {
                try {
                    fs.appendFile(dest, chunk, (err, out, e) => {
                        if (out) {
                            console.log(out);
                        }
                        if (err || e) {
                            $this.onFail.call($this, dest, chunk, err, e);
                        } else {
                            if ($this.timer) {
                                clearTimeout($this.timer);
                            }
                            $this.events.fire('success', chunk, dest);
                        }
                        $this.events.fire('writeEnd', dest);
                        if ($this.isLast(length)) {
                            if (min) {
                                $this.minify();
                            } else {
                                $this.events.fire('merged', dest);
                            }
                        }
                    });
                } catch(e) {
                    $this.onFail.call($this, dest, chunk, e);
                    outcome = e;
                } finally {
                    callback(outcome);
                }
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
                    $this.events.fire('minifyError', 'Minify Read Error', err);
                }
                let mi = {};
                try {
                    mi = mini.minify(file);
                } catch(e) {
                    $this.events.fire('minifyError', 'Terser Error', e);
                }
                if (mi.error) {
                    $this.events.fire('minifyError', 'Minify Error', mi.error);
                }
                fs.writeFile(minPath, mi.code, 'utf-8', (err, out, errMsg) => {
                    if (err || errMsg) {
                        return $this.events.fire('minifyError', 'Minify Write Error', err, errMsg);
                    }
                    if (out) {
                        console.log(out);
                    }
                    $this.events.fire('merged', dest);
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
    
    pipe(reader, cb, dest, length, min, timeout) {
        let $this = this;
        reader.on('error', function(e) {
            $this.events.fire('writeEnd', dest);
            $this.events.fire('error', 'Read Stream Error', e);
            cb(e);
        });
        reader.on('readable', function() {
            let data = this.read();
            while (data) {
                if (data == null) {
                    if ($this.timer) {
                        clearTimeout($this.timer);
                    }
                    $this.events.fire('success', data, dest);
                    $this.events.fire('writeEnd', dest);
                    if ($this.isLast(length)) {
                        if (min) {
                            $this.minify();
                        } else {
                            $this.events.fire('merged', dest);
                        }
                    }
                    cb(null);
                } else {
                    fs.appendFile(dest, data, (err, out, e) => {
                        if (out) {
                            console.log(out);
                        }
                        if (err || e) {
                            $this.onFail.call($this, dest, data, err, e);
                        } else {
                            data = this.read();
                        }
                    });    
                }
            }
        });
    }
    
    onFail(dest, chunk, ...errs) {
        let f = this.events.calc('fail', chunk, dest);
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