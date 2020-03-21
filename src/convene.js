const fs = require('fs');
const path = require('path');
//const config = require('../lib/config');
const Read = require('../lib/read');
const Write = require('../lib/write');
const Data = require('../lib/data');
const Events = require('@srcer/events');
const mini = require('terser');
const { Writable } = require('stream');
const { exec } = require('child_process');
const { echo } = require('ternal');
class Convene {
    constructor(timeout) {
        this.timeout = timeout || 30000;
        this.events = new Events(this);
        this.read = new Read(this.events);
        this.write = new Write(this.events);
        this.success = [];
        this.fail = [];
        this._defaultEvents();
    }
    
    merge(dest, clear) {
        let $this = this;
        if (!this.read.queue || !this.read.queue.length) {
            this.fire('error', 'Queue is empty');
        }

        if (!dest) {
            this.fire('error', 'No destination path found.')
        }
        if (this.gen) {
            this.fire('error', 'Writing in progress, cancel current queue before starting another');
        }
        let exts = /\.([^\.]{2,})$/.exec(dest);
        if (exts[1] && exts[1] == 'json' && this.read.length > 1) {
            this._wrapJson();
        }
        this.stream = this.write.stream(dest, this.read.length, this.timeout);
        this.gen = this.generate();
        
        if (clear) {
            let d, fileOnly;
            if (typeof clear === 'boolean') {
                d = dest;
                fileOnly = true;
            } else {
                let dirs = dest.split(clear);
                d = dirs[0] + '/' + clear;
            }
            this.on('clear', () => {
                $this.fire('next'); 
            });
            this.clear(d, fileOnly);
        } else {
            this.fire('next'); 
        }
    
        return this;
    }
    
    resize(callback) {
        this.read.resize(callback);
        return this;
    }
    
    queue(s, callback, ext) {
        if (s && typeof s === 'object' && !Array.isArray(s)) {
            for (let t in s) {
                if (s.hasOwnProperty(t)) {
                    let u = s[t];
                    let v = Array.isArray(u) ? this.getPaths(u, t, ext) : this.getPath(u, t, ext).loc;
                    this.read.enqueue(v, callback);
                }
            }
        } else {
            if (Array.isArray(s)) {
                for (let i = 0; i < s.length; i++) {
                    let w = s[i];
                    thir.read.enqueue(w, callback);
                }
            } else {
                this.read.enqueue(s, callback);
            }
        }
        return this;
    }
    
    requeue(s, callback, ext) {
        return new Convene(this.timeout).queue(s, callback, ext);
    }
    
    end() {
        if (this.stream && this.stream instanceof Writable && !this.stream.ended) {
            this.stream.end();
        }
        return this;
    }
    
    clear(dir, fileOnly) {
        let $this = this;
        exec('rm -rf "' + dir + '"', (err, out, errMsg) => {
            if (err || errMsg) {
                return $this.fire('error', 'Delete Directory Error', err, errMsg);
            }
            if (out) {
                console.log(out);
            }
            if (!fileOnly) {
                fs.mkdir(dir, () => {
                    $this.fire('clear', dir);
                });
            } else {
                $this.fire('clear', dir);
            }
        });
    }
    
    flow(writer, d) {
        let $this = this;
        let src = d.source;
        let data = d.data;
        this.fire('source', src);
        let res = writer.write(data);
        if (!res) {
            writer.once('drain', () => { 
                $this.fire('drained', src);
            });
        } else {
            $this.fire('drained', src);
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
            yield new Data('src-' + count, src, $this.events);
            count++;
        }
        return null;
    }
    
    on(ev, cb, calc) {
        this.events.on(ev, cb, calc);
        return this;
    }
    
    fire(ev, ...args) {
        this.events.fire(ev, ...args);
        return this;
    }
    
    getPaths(locs, dir, ext) {
        return locs.map(location => {
            let { loc } =  this.getPath(location, dir, ext);
            return loc;
        });
    }
    
    getPath(loc, dir, ext, root) {
        if (typeof loc !== 'string') {
            return {
                dir:dir,
                loc:loc
            }
        }
        ext = ext && ext.substring(0,1) != '.' ? '.' + ext : ext;
        loc = ext ? loc + ext : loc;
        root = root || process.cwd();
        dir = typeof dir === 'string' ? dir : '.';
        if (dir) {
            dir = path.resolve(root, dir);
            loc = path.resolve(dir, loc);
        } else {
            loc = path.resolve(this.root, loc);
        }
        return {
            dir:dir,
            loc:loc
        }
    }
    
    _defaultEvents() {
        let $this = this;
        this.on('merged', dest => {
            $this.gen = null;
            let msg = 'Data written to ' + dest;
            if ($this.fail.length) {
                msg = 'Data incomplete, sources ' + $this.fail.join(', ') + ' failed to write to destination'; 
                echo('red', msg);
            } else {
                msg = 'Data written to ' + dest;
                echo('green', msg);
            }
            $this.success = [];
            $this.fail = [];
            $this.fire('end');
        });
        this.on('error', (...args) => { 
            $this.end();
            echo('red', args.join(', '));
            process.exit(0);
        }); 
        this.on('success', (data, dest, src) => {
           $this.success.push(src); 
           $this.read.flush(src);
        });
        this.on('fail', (data, dest, src) => {
            $this.fail.push(src); 
            $this.read.flush(src);
        });
         
        this.on('end', function() {
            $this.end();
            $this.events = new Events($this);
            $this._defaultEvents();
        });
        
        this.on('next', () => {
            if ($this.gen) {
                let d = $this.gen.next().value;
                if (d) {
                    $this.flow($this.stream, d);
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

Convene.prototype.minify = function(dest) {
    let $this = this;
    fs.readFile(dest, 'utf-8', (err, file) => {
        if (err) {
            $this.fire('error', 'Minify Read Error', err);
        }
        let mi = {};
        try {
            let fl = $this.events.calc('minify', file);
            file = fl || file;
            mi = mini.minify(file);
        } catch(e) {
            $this.fire('error', 'Terser Error', e);
        }
        if (mi.error) {
            $this.fire('error', 'Minify Error', mi.error);
        }
        let minPath = dest.replace(/\.([^\.]{2,})$/, '.min.$1');
        fs.writeFile(minPath, mi.code, 'utf-8', (err, out, errMsg) => {
            if (err || errMsg) {
                return $this.fire('error', 'Minify Write Error', err, errMsg);
            }
            if (out) {
                console.log(out);
            }
            $this.fire('minified');
        });
    });

    return this;
}

module.exports = Convene;