const fs = require('fs');
const { Writable, Readable } = require('stream');

module.exports = class {
    constructor(events) {
        this.events = events;
        this.timer = null;
        this.currentSrc = null;
        this.events.on('readEnd', (cb, outcome) => {
           cb(outcome); 
        });
        let $this = this;
        this.events.on('source', src => {
           $this.currentSrc = src; 
        });
        this.events.on('merged', dest => {
            $this.currentSrc = null;
        });
    }
    
    reset() {
        if (this.stream) {
            this.stream.end;
        }
        this.timer = null;
    }
    
    stream(dest, length, timeout) {
        let $this = this;
        timeout = timeout || 30000;
        if (this._stream) {
            this._stream.end();
        }
        let stream = new Writable({
            objectMode:true,
            write: this.write(dest, length, timeout),
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
    
    write(dest, length, timeout) {
        let $this = this;
        return function(chunk, encoding, callback) {
            let outcome = null;
           
            if (timeout && timeout > 0) {
                $this.timer = setTimeout(() => {
                    $this.events.fire('error', 'Event timed out: ' + dest + ' took too long to respond'); 
                 }, timeout);
            }
            let chunks = $this.events.calc('writing', chunk);
            chunk = chunks || chunk;
            if (!chunk) {
                callback('No data found');
            }
            if (chunk instanceof Readable) {
                $this.pipe(chunk, callback, dest, length, timeout);
            } else {
                try {
                    fs.appendFile(dest, chunk, (err, out, e) => {
                        if (out) {
                            console.log(out);
                        }
                        if (err || e) {
                            $this.events.fire('fail', dest, $this.currentSrc);
                        } else {
                            if ($this.timer) {
                                clearTimeout($this.timer);
                            }
                            $this.events.fire('success', chunk, dest, $this.currentSrc);
                        }
                        $this.events.fire('writeEnd', dest, $this.currentSrc);
                        if ($this.isLast(length)) {
                            $this.events.fire('merged', dest);
                        }
                    });
                } catch(e) {
                    $this.events.fire('fail', dest, $this.currentSrc);
                    outcome = e;
                } finally {
                    callback(outcome);
                }
            }
        }
    }
    
    pipe(reader, cb, dest, length) {
        let $this = this;
        reader.on('error', function(e) {
            $this.events.fire('writeEnd', dest, $this.currentSrc);
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
                    $this.events.fire('success', data, dest, $this.currentSrc);
                    $this.events.fire('writeEnd', dest, $this.currentSrc);
                    if ($this.isLast(length)) {
                        $this.events.fire('merged', dest);
                    }
                    cb(null);
                } else {
                    fs.appendFile(dest, data, (err, out, e) => {
                        if (out) {
                            console.log(out);
                        }
                        if (err || e) {
                            $this.events.fire('fail', dest, $this.currentSrc);
                        } else {
                            data = this.read();
                        }
                    });    
                }
            }
        });
    }
}