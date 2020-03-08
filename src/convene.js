const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const Base = require('../lib/base');
const { Writable } = require('stream');
const Data = require('./data');
const Events = require('../lib/events');
const Write = require('../lib/write');
const Obj = require('../lib/object');
class Convene extends Base {
    constructor(options) {
        super();
        if (typeof options === 'boolean') {
            this.min = options;
            options = {};
        }
        options = options || {};
        this.dest = options.dest || options.file || null;
        this.dir = options.dir || options.directory || '';
        this.ext = options.ext || options.extension || 'js';
        this.root = options.root || process.cwd();
        this.min = options.min ? true : false;
        this.objectMode = options.objectModeOff ? false : true;
        this.encoding = options.encoding || options.enc || 'utf-8';
        this.timeout = options.timeout ? options.timeout : null;
        this.events = new Events(this, this.reset);
        this._writable = {};
        this.writable = [];
        this.written = [];
        this.gen = null;
        this.currentSrc = null;
    }
    
    get length() {
        return this.writable.length + this.written.length;
    }
    
    merge(dest, dir, ext, min) {
        if (!this.writable || !this.writable.length) {
            return this.events.fire('error', 'Queue is empty');
        }
        if (dest) this.dest = dest;
        if (dir != null && typeof dir !== 'undefined') this.dir = dir;
        if (typeof min === 'boolean') this.min = min;
        if (ext) this.ext = ext;
        if (!this.dest) {
            return this.events.fire('error', 'No destination path found.')
        }
        if (this.gen) {
            return this.events.fire('error', 'Writing in process, cancel current queue before starting another');
        }
        if (this.ext == 'json' && this.length > 1) {
            this._wrapJson();
        }
        let { loc } = this.getPath(this.dest, this.dir);
        this.loc = loc;
        let $this = this;
        if (!this.isWritable()) {
            this.end();
        }
        if (this.objectMode) {
            this.writeObject = new Obj(this, loc, this.ext, this.min);
        }
        
        this.write = new Write(this, loc, this.ext, this.min);
        this.gen = this.generate();
        this.clear(this.dest, this.dir, () => { $this.events.fire('next') });
        return this;
    }
    
    set writable(w) {
        if (w == [] || w == {} || !w) {
            this._writable = {};
        } else {
            this._writable = Object.assign({}, this._writable, w);
        }
    }
    
    get writable() {
        return Object.values(this._writable);
    }
    
    get writableSources() {
        return Object.keys(this._writable);
    }     
    
    logWritten(s) {
        if (this._writable[s]) {
            delete this._writable[s];
        }
        if (!this.written.includes(s)) {
            this.written.push(s);
        }
        return this;
    }

    flow(d) {
        let $this = this;
        let src = d.source;
        let data = d.data;
        this.events.fire('source', src);
        let objectMode = !(this.isReadable(data)) && this.objectMode;
        if (objectMode) {
            let res = this.writeObject.stream.write(data);
            if (!res) {
                $this.writeObject.stream.once('drain', () => { 
                    $this.events.fire('drained', src);
                });
            } else {
                $this.events.fire('drained', src);
            }
        } else {
            let $this = this;
            this.events.on('readEnd', function() {
                $this.events.fire('drained', src);
            });
            let Read = require('../lib/read');
            let read = new Read(this.events, data, this.encoding);
            read.start(this.write.stream, data);
        }
        return this;
    }

    
    queue(src, dir, callback, ext) {
        if (typeof dir === 'function') {
            callback = dir;
            dir = '';
        }
        if (typeof callback === 'string') {
            ext = callback;
            callback = null;
        }
        if (src && typeof src === 'object' && !(Array.isArray(src))) {
                let dirs = Object.keys(src);
                dirs.forEach(direc => {
                    let source;
                    if (src[direc] && src[direc].source) {
                        source = src[direc].source;
                    } else {
                        source = src[direc];
                    }
                    let s = this.getWritable(source, direc, callback, ext);
                    this.writable = s;
                }, this);
        } else {
            let s = this.getWritable(src, dir, callback, ext);
            this.writable = s;
        }

        return this;
    }
    
    getWritable(src, dir, callback, ext, type) {
        if (typeof callback !== 'function') {
            callback = (dest, acc, ind) => {
                if (dest) {
                    acc[ind] = dest;
                }
                return acc;
            }
        }
        if (src == '*') {
            let dirPath = path.resolve(this.root, dir);
            src = fs.readdirSync(dirPath);
        }
        if (!Array.isArray(src)) {
            src = [src];
        }
        if (!src || !src.length) {
            return this.events.fire('error', 'No queueing source provided');
        }
        let $this = this;
        ext = ext || this.ext;
        type = type || {};
        return src.reduce((acc, sr, ind) => {
            if (typeof sr === 'string') {
                sr = sr.replace('.' + ext, '');
            }
            let { loc } = $this.getPath(sr, dir, ext);
            let res = fs.existsSync(loc) ? loc : sr;
            return callback.call($this, res, acc, ind);
        }, type);
    }
    
    clear(dest, dir, callback) {
        let $this = this;
        if (dir) {
            exec('rm -rf "' + dir + '"', (err, out, errMsg) => {
                if (err || errMsg) {
                    return this.events.fire('error', 'Delete Directory Error', err, errMsg);
                }
                if (out) {
                    console.log(out);
                }
                fs.mkdir(dir, () => {
                    callback.call($this);
                });
            });
        } else {
            let { loc } = this.getPath(dest);
            if (this.min) {
                let min = loc.replace('.' + this.ext, '.min.' + this.ext);
                if (fs.existsSync(min)) {
                    fs.unlinkSync(min);
                }
            }
            exec('rm "' + loc + '"', (err, out, errMsg) => {
                if (err || errMsg) {
                    return this.events.fire('error', 'Delete File Error', err, errMsg);
                }
                if (out) {
                    console.log(out);
                }
                fs.mkdir(dir, () => {
                    callback.call($this);
                });
            });
        }
    }

    * generate() {
        let count = 0;
        let srces = this.writableSources;
        let writables = this.writable;
        while(writables[count]) {
            this.currentSrc = srces[count];
            yield new Data(this, srces[count], writables[count]);
            count++;
        }
        this.currentSrc = null;
        return null;
    }
    
    getPath(loc, dir, ext) {
        if (typeof loc !== 'string') {
            return {
                dir:dir,
                loc:loc
            }
        }
        ext = ext || this.ext;
        if (dir) {
            dir = path.resolve(this.root, dir);
            loc = path.resolve(dir, loc + '.' + ext);
        } else {
            loc = path.resolve(this.root, loc + '.' + ext);
        }
        return {
            dir:dir,
            loc:loc
        }
    }
    
    reset() {
        this.writable = [];
        this.written = [];
        this.gen = null;
        this.events = new Events(this, this.reset);
        this.events.fire('end');
        return this;
    }
    
    end() {
        if (this.write && this.write.stream && !this.write.ended) {
           
            this.write.stream.end();
        }
        if (this.writeObject && this.writeObject.stream && !this.writeObject.ended) {
            this.writeObject.stream.end();
        }
        return this;
    }
    
    writeObjectActive() {
        return this.objectMode && 
            this.writeObject && 
            this.writeObject.stream instanceof Writable &&
            !this.writeObject.stream.ended
    }
    
    writeActive() {
        return this.write && 
            this.write.stream instanceof Writable &&
            !this.write.stream.ended
    }
    
    isWritable() {
        return (!this.write || 
            !this.write.stream || 
            this.write.stream.ended) &&
            (!this.writeObject || 
            !this.writeObject.stream || 
            this.writeObject.stream.ended);
    }
    
    _wrapJson() {
        if (!this.length) {
            return;
        }
        let r = {};
        let q = this.getWritable(this.writable, null, (dest, acc) => {
            acc.push(dest);
            return acc;      
        }, 'json', []);
        r[this.writableSources[0]] = [JSON.stringify(q, null, '\t')];
        this.writable = null;
        this.writable = r;
        return this;
    }
}

Convene.prototype.require = function(src, dir, ext) {
    return this.queue(src, dir, (dest, acc) => {
        let res = null;
        try {
            res = require(dest);
        } catch(e) {
            res = dest;
        } finally {
            if (res) {
                acc[dest] = res;
            }
            return acc;
        }
    }, ext);
}

Convene.prototype.combine = function(name, ext) {
    if (!this.objectMode) {
        this.events.fire('error', 'Combine can only be used in object mode');
    }
    if (!this.length) {
        this.events.fire('error', 'Queue is empty, nothing to combine');
    }
    let $this = this;
    name = name || this.writableSources[0];
    let r = {};
    let q = this.getWritable(this.writable, null, (dest, acc, ind) => {
        if (typeof dest === 'object') {
            acc = Object.assign({}, acc, dest);
        } else {
            acc[$this.writableSources[ind]] = dest;
        }
        return acc;      
    }, ext);
    r[name] = q;
    this.writable = null;
    this.writable = r;
    return this;
}

Convene.prototype.json = function(src, dir, suppress) {
    if (!suppress) {
        this.ext = 'json';
    }
    return this.require(src, dir, 'json');
}

module.exports = Convene;