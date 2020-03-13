const fs = require('fs');
const path = require('path');
//const config = require('../lib/config');
const Read = require('../lib/read');
const Write = require('../lib/write');
const Data = require('../lib/data');
const Events = require('../lib/events');
const { Writable } = require('stream');
const { exec } = require('child_process');
class Convene {
    constructor(root) {
        let $this = this;
        this.root = typeof root === 'string' ? root : process.cwd();
        this.events = new Events(() => this.reset.call($this));
        this.read = new Read(this.events);
        this.write = new Write(this.events);
        this._defaultEvents();
    }
    
    merge(dest, dir, ext, min, timeout) {
        if (typeof ext === 'boolean') {
            min = ext;
            ext = 'js';
        } else {
            ext = ext || this.ext || 'js';
        }
        
        if (!this.read.queue || !this.read.queue.length) {
            return console.warn('Queue is empty');
        }
        if (!dest) {
            return console.warn('No destination path found.')
        }
        if (this.gen) {
            return console.warn('error', 'Writing in process, cancel current queue before starting another');
        }
        if (ext == 'json' && this.read.length > 1) {
            this._wrapJson();
        }
        let { loc } = this.getPath(dest, dir, ext);
        let $this = this;
        this.stream = this.write.stream(loc, this.read.length, min, timeout);
        this.gen = this.generate();
        this.clear(dest, dir, () => { $this.events.fire('next', this.stream, this.gen) });
        return this;
    }
    
    transform(callback) {
        this.write.transform(callback);
        return this;
    }
    
    resize(callback) {
        this.read.transform(callback);
        return this;
    }
    
    queue(s, callback, ext) {
        let exts = s.split('.');
        if (exts.length > 1) {
            ext = exts.pop();
            s = exts.join('');
        } else {
            ext = ext || 'js';
        }
        this.ext = ext;
        if (s && typeof s === 'object' && !Array.isArray(s)) {
            for (let t in s) {
                if (s.hasOwnProperty(t)) {
                    let u = s[t];
                    let v = Array.isArray(u) ? this.getPaths(u, t, ext) : this.getPath(u, t, ext).loc;
                    this.read.enqueue(v, callback);
                }
            }
        } else {
            this.read.enqueue(s, callback);
        }
        return this;
    }
    
    getPaths(locs, dir, ext) {
        return locs.map(location => {
            let { loc } =  this.getPath(location, dir, ext);
            return loc;
        });
    }
    
    getPath(loc, dir, ext) {
        if (typeof loc !== 'string') {
            return {
                dir:dir,
                loc:loc
            }
        }
        dir = typeof dir === 'string' ? dir : '.';
        if (ext === false || ext === '') {
            ext = '';
        } else {
            ext = ext || 'js';
        }
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
        this.events = new Events();
        this.gen = null;
        this._defaultEvents();
        this.events.fire('end');
        return this;
    }
    
    end() {
        if (this.stream && this.stream instanceof Writable && !this.stream.ended) {
            this.stream.end();
        }
        return this;
    }
    
    clear(dest, dir, callback) {
        let $this = this;
        if (dir) {
            exec('rm -rf "' + dir + '"', (err, out, errMsg) => {
                if (err || errMsg) {
                    return $this.events.fire('error', 'Delete Directory Error', err, errMsg);
                }
                if (out) {
                    console.log(out);
                }
                fs.mkdir(dir, () => {
                    callback.call($this);
                });
            });
        } else {
            if (this.min) {
                let min = dest.replace('.' + this.ext, '.min.' + this.ext);
                if (fs.existsSync(min)) {
                    fs.unlinkSync(min);
                }
            }
            exec('rm "' + loc + '"', (err, out, errMsg) => {
                if (err || errMsg) {
                    return $this.events.fire('error', 'Delete File Error', err, errMsg);
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
    
    flow(writer, d) {
        let $this = this;
        let src = d.source;
        let data = d.data;
        this.events.fire('source', src);
        let res = writer.write(data);
        if (!res) {
            writer.once('drain', () => { 
                $this.events.fire('drained', src);
            });
        } else {
            $this.events.fire('drained', src);
        }
        return this;
    }
    
    * generate() {
        let count = 0;
        let sources = this.read.sources;
        let writables = this.read.queue;
        let $this = this;
        while(writables[count]) {
            let src = writables[count](sources[count]);
            yield new Data(sources[count], src, $this.events);
            count++;
        }
        return null;
    }
    
    on(ev, cb) {
        this.events.on(ev, cb);
        return this;
    }
    
    _defaultEvents() {
        let $this = this;
        this.on('merged', (loc) => {
            let msg = 'Data written to ' + loc;
            console.log(msg);
        });

        this.on('error', (...args) => { 
            $this.end().reset();
            throw new Error(args.join(', '));
         });  
        
        this.on('next', (stream, gen) => {
            if (gen) {
                let d = gen.next().value;
                if (d) {
                    $this.flow(stream, d);
                } else {
                    $this.end();
                }
            }
        });
    }
    
    _wrapJson() {
        if (!this.read.length) {
            return;
        }
        let r = {};
        let $this = this;
        let q = this.read.queue.map((fn, ind) => fn($this.read.sources[ind]));
        r = JSON.stringify(q, null, '\t');
        this.read.flush();
        this.queue(r);
        return this;
    }
}

module.exports = Convene;