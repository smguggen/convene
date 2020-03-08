const Base = require('./base');
const mini = require('terser');
const { Writable } = require('stream');
const fs = require('fs');

module.exports = class extends Base {
    constructor(parent, dest, ext, min) {
        super();
        this.parent = parent;
        this._min = min;
        this.ext = ext;
        this.dest = dest;
        this.objectMode = false;
        this.timer = null;
    }  
    
    set source(src) {
        this._source = src;
    }
    
    get source() {
        return this._source || null;    
    }
    
    onFail(chunk, ...errs) {
        let f = this.parent.events.calc('fail', chunk, this.source);
        if (f) {
            console.log('Write Error', ...errs);
        } else {
            throw new Error('Write Error', ...errs);
        }
    }
    
    get stream()  {
        let $this = this;
        let stream;
        stream = new Writable({ 
            objectMode: $this.objectMode,
            write:(chunk, encoding, callback) => {
                let newChunk = $this.parent.events.calc('writing', chunk, encoding);
                chunk = newChunk ? newChunk : chunk;
                let outcome = null;
                
                if ($this.parent.timeout) {
                    $this.timer = setTimeout(() => {
                       $this.parent.events.fire('error', 'Event timed out: ' + $this.source + ' took too long to process'); 
                    }, $this.parent.timeout);
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
                            $this.parent.events.fire('success', chunk, $this.source);
                        }
                        $this.parent.events.fire('writeEnd', $this.source);
                        if ($this.parent.events.counts.writeEnd == $this.parent.length) {
                            $this.onFinish();
                        }
                    });
                } catch(e) {
                    $this.onFail.call($this, chunk, e);
                    outcome = e;
                } finally {
                    callback(outcome);
                }
            } 
        });
        stream.on('error', (err, out, errMsg) => {
            if (err || errMsg) {
                return this.parent.events.fire('error', 'Write Stream Error', err, errMsg);
            }
            if (out) {
                console.log(out);
            }
        });
        stream.path = $this.dest;
        if (!$this.objectMode) {
            stream.on('pipe', function(read) {
                $this.parent.events.fire('reading', this, read);
                    read.on('error', (err) => {
                        $this.parent.events.fire('error', 'Read Error', err);
                    });
                    read.on('end', function() {
                        $this.parent.events.fire('readEnd', this);
                    });
                    $this.parent.events.fire('pipe', this, read);
            });
        }
        return stream;
    }
    
    onFinish() {
        let $this = this;
        if ($this._min) {
            let min = this.path.replace('.' + $this.ext, '.min.' + $this.ext);
            fs.readFile(this.path, 'utf8', (err, file) => {
                if (err) {
                    $this.parent.events.fire('error', 'Minify Read Error', err);
                }
                let mi = mini.minify(file);
                if (mi.error) {
                    $this.parent.events.fire('error', 'Minify Error', mi.error);
                }
                fs.writeFile(min, mi.code, 'utf8', (err, out, errMsg) => {
                    if (err || errMsg) {
                        return this.parent.events.fire('error', 'Minify Write Error', err, errMsg);
                    }
                    if (out) {
                        console.log(out);
                    }
                    $this.parent.events.fire('merged', $this.dest);
                });
            });
        } else {
            $this.parent.events.fire('merged', $this.dest);
        }
    }
}