const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const Base = require('../lib/base');
const { Writable } = require('stream');
const Data = require('./data');
const Events = require('../lib/events');
class Convene extends Base {
    constructor(options) {
        super();
        this._init(options); 
    }
    
    send(dest, dir, min) {
        if (!this.writable || !this.writable.length) {
            return this.events.fire('error', 'Queue is empty');
        }
        if (dest) {
            this.dest = dest;
        }
        if (!this.dest) {
            return this.events.fire('error', 'No destination path found.')
        }
        if (this.gen) {
            return this.events.fire('error', 'Writing in process, cancel current queue before starting another');
        }
        if (dir) {
            this.dir = dir;
        }
        if (typeof min === 'boolean') {
            this.min = min;
        }
        let { loc } = this.getPath(this.dest, this.dir);
        let $this = this;
        if (!this.isWritable()) {
            this.end();
        }
        if (this.objectMode) {
            let Obj = require('../lib/object');
            this.writeObject = new Obj(this, loc, this.ext, this.min);
        }
        let Write = require('../lib/write');
        this.write = new Write(this, loc, this.ext, this.min);
        this.gen = this.generate();
        return this.clear(dest, dir, () => { $this.events.fire('next') });
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

    
    queue(src, dir, callback) {
        let $this = this;
        if (!src) {
            return this.fire('error', 'No queueing source provided');
        }
        if (!(typeof callback === 'function')) {
            return this.fire('error', 'No queueing callback provided');
        }
        if (!Array.isArray(src)) {
            src = [src];
        }
        if (src && src.length) {
            let s = src.reduce((acc, sr) => {
                let { loc } = $this.getPath(sr, dir);
                let res = callback.call($this, loc);
                if (res) {
                    acc[sr] = res;
                }
                return acc;
            }, {});
            this.writable = s;
        }
        return this;
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
        this.writable = [];
        this.written = [];
        this.gen = null;
        this.events = new Events(this);
        return this;
    }
    
    end() {
        if (this.write && this.write.stream && !this.write.ended) {
           
            this.write.stream.end();
        }
        if (this.writeObject && this.writeObject.stream && !this.writeObject.ended) {
            this.writeObject.stream.end();
        }
        return this.reset();
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
    
    setOptions(options) {
        if (typeof options === 'boolean') {
            this.min = options;
            options = {};
        }
        options = options || {};
        this.dest = options.dest || null;
        this.dir = options.dir || '';
        this.ext = options.ext || 'js';
        this.root = options.root || process.cwd();
        this.min = options.min ? true : false;
        this.objectMode = options.objectModeOff ? false : true;
        this.encoding = options.encoding || 'utf-8';
        this.timeout = options.timeout ? options.timeout : null;
    }
    
    _init(options) {
        this.events = new Events(this);
        this.setOptions(options);
        this._writable = {};
        this.writable = [];
        this.written = [];
        this.gen = null;
        this.currentSrc = null;
    }
}

Convene.prototype.require = function(src, dir) {
    let $this = this;
    return this.queue(src, dir, (dest) => {
        let res = null;
        try {
            res = require(dest);
        } catch(e) {
            $this.fire('queueError', e);
        } finally {
            return res;
        }
    });
}

module.exports = Convene;