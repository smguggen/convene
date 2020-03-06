const fs = require('fs');
const path = require('path');
const mini = require('terser');
const { exec } = require('child_process');
const { Writable, Readable } = require('stream');
const buffer = require('buffer');
module.exports = class {
    constructor(options) {
        this._init(options);
        
    }
    
    write(dest, dir, min, obj) {
        let { loc } = this.getPath(dest, dir);
        if (this.streaming) {
           this.stream.end();
           this.streaming = false;
        }
        if (!this._writable || !this._writable.length) {
            return this.fire('error', 'Queue is empty');
        }
        if (typeof min === 'boolean') {
            this.min = min;
        }
        if (typeof obj === 'boolean') {
            this.objectMode = obj;
        }
        this.stream = this.writeStream(loc);
        this.gen = this.generate();
        let d = this.gen.next().value
        return this.readStream(this.stream);
    }
    writeStream(dest,bufferEncoding) {
        let $this = this;
        let stream;
        stream = new Writable({ 
            objectMode: $this.objectMode ? true : false, 
            write:(chunk, encoding, callback) => {
                console.log('writing...');
                $this.fire('writing', chunk)
                let outcome = null;
                try {
                    fs.appendFile(dest, chunk + '\n', $this.callErr());
                } catch(e) {
                    outcome = e;
                } finally {
                    console.log(outcome);
                    callback(outcome);
                }
                console.log('done writing...');
            } 
        });
        this.streaming = true;
        if (this.min) {
            this._min(stream);
        }
        stream.on('error', this.callErr());
        stream.path = dest;
        stream.on('end', () => {
            $this.reset();
            let msg = $this.min ? 'Objects written to ' + dest : 'File path is ' + dest;
            console.info(msg); 
            $this.fire('written');
        });
        stream.on('pipe', function(read) {
                read.on('error', (err) => {
                    $this.err(err);
                    $this.end();
                });
                read.on('end', () => {
                    console.log('ENDED');
                    if ($this.gen && false) {
                        let f = $this.gen.next().value;
                        if (f) {
                            $this.readStream(f, stream, bufferEncoding);
                        } else {
                            $this.end();
                            $this.gen = null;
                            let msg = $this.min ? 'Files written to ' + dest : 'File path is ' + dest;
                            console.info(msg); 
                            $this.fire('written');
                        }
                    } else {
                        $this.end();
                    }
                });
        });
        return stream;
    }
    
    readStream(writeStream, bufferEncoding) {
        if (!this.gen) {
            return this.fire('error', 'No read source found');
        }

        if (writeStream instanceof Writable) {
            //bufferEncoding = bufferEncoding || 'utf8';
            let $this = this;
            let options = {
                objectMode: $this.objectMode,
                encoding:$this.encoding,
                read: function(size) {
                    console.log('reading...');
                    let res;
                    let f = $this.gen.next().value;
                    if (f) {
                        res = $this.fire('reading', f, size);
                        res = res ? res : f;
                    }
                    if ($this.isReadable(res)) {
                        let d;
                        do {
                            d = this.push(res, $this.encoding);
                        } while(d);
                        this.push(null);
                    } else {
                        let msg = 'Source not readable';
                        $this.fire('error', msg);
                        console.warn(msg);
                    }
                    console.log('done reading...');
                } 
            }
            let read = new Readable(options);
            read.on('data', (chunk) => {
                while (res = writeStream.write(chunk))
            });
        } else {
            console.warn('No Write Stream found, create a write stream to read to before reading data');
            return this;
        }
    }
    
    get maxLength() {
        if (['utf8', 'utf-8'].includes(this.encoding)) {
            return buffer.constants.MAX_STRING_LENGTH;
        } else {
            return buffer.constants.MAX_LENGTH
        }
    }
    
    queue(src, dir) {
        let $this = this;
        if (!src) {
            return;
        }
        if (!Array.isArray(src)) {
            src = [src];
        }
        if (src && src.length) {
            let s = src.map(sr => $this._queue.call(this, sr, dir));
            if (s && s.length) {
                this._writable = this._writable.concat(s);
            }
        }
        return this;
    }
    
    _queue(src, dir) {
        let file = this.getPath(src, dir);
        return file;
    }
    
    clear(dir, callback) {
        let $this = this;
        exec('rm -rf "' + dir + '"', (err, out, errMsg) => {
            $this.fire('error', err, out, errMsg);
            fs.mkdir(dir, () => {
                callback.call($this);
            });
        });
    }

    * generate() {
        let count = 0;
        while(this._writable[count]) {
            yield this._writable[count];
            count++;
        }
        return null;
    }
    
    isReadable(src) {
        return this.objectMode || 
            typeof src === 'string' ||
            src instanceof Buffer ||
            src instanceof Uint8Array
    }
    
    _min(stream) {
        let $this = this;
        if (stream instanceof Writable) {
            stream.on('finish', function() {
                let min = this.path.replace('.' + $this.ext, '.min.' + $this.ext);
                fs.readFile(this.path, 'utf8', (err, file) => {
                    $this.err(err);
                    let mi = mini.minify(file);
                    if (mi.error) {
                        $this.err(mi.error);
                        return;
                    }
                    fs.writeFile(min, mi.code, 'utf8', $this.callErr());
                });
            });
        }
        return this;
    }
    
    getPath(loc, dir) {
        if (dir) {
            dir = path.resolve(this.root, dir);
            loc = path.resolve(dir, loc + '.' + this.ext);
        } else {
            loc = path.resolve(this.root, loc + '.' + this.ext);
        }
        return {
            dir:dir,
            loc:loc
        }
    }
    
    reset() {
        this._writable = [];
        this.valid.forEach(ev => {
            this[ev] = [];
        }, this);
        this.on('error', (err, out, e) => { this.err(err, out, e) });
        return this;
    }
    
    end() {
        if (this.stream && !this.stream.ended) {
            this.stream.end();
            this.streaming = false;
        }
        return this.reset();
    }
    
    on(event, callback) {
        if (this.valid.includes(event) && typeof callback === 'function') {
            this[event].push(callback);
        }
    }
    
    fire(event, ...args) {
        let res = null;
        if (this.valid.includes(event) && this[event].length) {
            this[event].forEach(ev => {
                res = ev.call(this, res, ...args)
            }, this);
        }
        return res;
    }
    
    err(err, out, e) {
        if (err) {
            this.end();    
            console.warn(err);
        }
        if (out) {
            console.log(out);
        }
        if (e) {
            this.end();
            console.warn(e);
        }
    }
    
    callErr() {
        let $this = this;
        return (err, out, e) => {
            $this.fire('error', err, out, e);
        }
    }
    
    setOptions(options) {
        options = options || {};
        this.ext = options.ext || 'js';
        this.root = options.root || process.cwd();
        this.min = options.min ? true : false;
        this.objectMode = options.objectMode ? true : false;
        this.encoding = options.encoding || 'utf-8';
    }
    
    _init(options) {
        this.setOptions(options);
        this._writable = [];
        this.gen = null;
        this.valid = ['written', 'reading', 'writing', 'error', 'queueError'];
        this.valid.forEach(ev => {
            this[ev] = [];
        }, this);
        this.on('error', (err, out, e) => { this.err(err, out, e) });
        this.streaming = false;
    }
}