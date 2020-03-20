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
    constructor(dest, dir) {
        let $this = this;
        this.dir = dir;
        this.dest = dest;
        this.events = new Events(this);
        this.read = new Read(this.events);
        this.write = new Write(this.events);
        this._defaultEvents();
    }
    
    merge(dest, dir, timeout) {
        
        if (!this.read.queue || !this.read.queue.length) {
            return console.warn('Queue is empty');
        }
        if (dest) {
            this.dest = dest;
        }
        if (!this.dest) {
            return console.warn('No destination path found.')
        }
        if (dir) {
            this.dir = dir;
        }
        if (this.gen) {
            return console.warn('error', 'Writing in process, cancel current queue before starting another');
        }
        let exts = /\.([^\.]{2,})$/.exec(this.dest);
        if (exts[1] && exts[1] == 'json' && this.read.length > 1) {
            this._wrapJson();
        }
        let $this = this;
        this.stream = this.write.stream(this.dest, this.read.length, timeout);
        this.gen = this.generate();
        
        if (this.dir) {
            let dirs = this.dest.split(dir);
            let d = dirs[0] + '/' + dir;
            $this.events.on('clear', () => {
                $this.events.fire('next'); 
            });
            this.clear(d);
        } else {
            $this.events.fire('next'); 
        }
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
    
    end() {
        if (this.stream && this.stream instanceof Writable && !this.stream.ended) {
            this.stream.end();
        }
        return this;
    }
    
    clear(dir) {
        let $this = this;
        exec('rm -rf "' + dir + '"', (err, out, errMsg) => {
            if (err || errMsg) {
                return $this.events.fire('error', 'Delete Directory Error', err, errMsg);
            }
            if (out) {
                console.log(out);
            }
            fs.mkdir(dir, () => {
                $this.events.fire('clear', dir);
            });
        });
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
            yield new Data('src-' + count, src, $this.events);
            count++;
        }
        return null;
    }
    
    on(ev, cb) {
        this.events.on(ev, cb);
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
        root = root || process.cwd();
        dir = typeof dir === 'string' ? dir : '.';
        if (ext === false || ext === '') {
            ext = '';
        } else {
            ext = ext || 'js';
        }
        if (ext) {
            ext = '.' + ext;
        } else {
            ext = '';
        }
        if (dir) {
            dir = path.resolve(root, dir);
            loc = path.resolve(dir, loc + ext);
        } else {
            loc = path.resolve(this.root, loc + ext);
        }
        return {
            dir:dir,
            loc:loc
        }
    }
    
    _defaultEvents() {
        let $this = this;
        this.on('merged', (loc) => {
            let msg = 'Data written to ' + loc;
            echo('green', msg);
        });
        this.on('error', (...args) => { 
            $this.end();
            echo('red', args.join(', '));
            process.exit(0);
         }); 
         
         this.on('end', function() {
            $this.end();
            $this.events = new Events($this);
            $this.gen = null;
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
    dest = dest || this.dest;
    fs.readFile(dest, 'utf-8', (err, file) => {
        if (err) {
            $this.events.fire('error', 'Minify Read Error', err);
        }
        let mi = {};
        try {
            mi = mini.minify(file);
            let mis = $this.events.calc('minify', mi);
            mi = mis || mi;
        } catch(e) {
            $this.events.fire('error', 'Terser Error', e);
        }
        if (mi.error) {
            $this.events.fire('error', 'Minify Error', mi.error);
        }
        let minPath = dest.replace(/\.([^\.]{2,})$/, '.min.$1');
        fs.writeFile(minPath, mi.code, 'utf-8', (err, out, errMsg) => {
            if (err || errMsg) {
                return $this.events.fire('error', 'Minify Write Error', err, errMsg);
            }
            if (out) {
                console.log(out);
            }
            $this.events.fire('minified');
        });
    });

    return this;
}

module.exports = Convene;