const fs = require('fs');
const path = require('path');
const mini = require('terser');
const { exec } = require('child_process');
const { Writable } = require('stream');

module.exports = class {
    
    constructor(root, ext) {
        this.root = root || process.cwd();
        this.toWrite = [];
        this.src = this.root;
        this.stream = null;
        this.written = [];
        this.valid = ['written'];
        this.ext = ext || 'js';
    }
    
    createStream(dest, min) {
        let stream = fs.createWriteStream(dest);
        stream.on('error', this.callErr());
        if (min) {
            this.min(stream);
        }
        return stream;
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
        return (err, out, e) => { $this.err(err, out, e) };
    }
    
    * generate() {
        let count = 0;
        while(this.toWrite[count]) {
            yield this.toWrite[count];
            count++;
        }
        return null;
    }
    
    add(files, src) {
        let $this = this;
        if (typeof files === 'string') {
            files = [files];
        }
        let root = src ? path.resolve(this.root, src) : this.root;
        let f = files.map(file => path.join(root, file + '.' + $this.ext)).filter(file => !$this.toWrite.includes(file));
        if (f && f.length) {
            this.toWrite = this.toWrite.concat(f);
        }
        
        return this;
    }
    
    min(stream) {
        let $this = this;
        if (stream instanceof Writable) {
            stream.on('finish', function() {
                let min = this.path.replace('.' + $this.ext, '.min.' + $this.ext);
                fs.readFile(this.path, 'utf-8', (err, file) => {
                    $this.err(err);
                    let mi = mini.minify(file);
                    if (mi.error) {
                        $this.err(mi.error);
                        return;
                    }
                    fs.writeFile(min, mi.code, 'utf-8', $this.callErr());
                });
            });
        }
        return this;
    }
    
    reset() {
        this.toWrite = [];
        this.result = '';
        this.valid.forEach(ev => {
            this[ev] = [];
        }, this);
    }
    
    end() {
        if (this.stream && !this.stream.ended) {
            this.stream.end();
        }
        this.reset();
    }
    
    on(event, callback) {
        if (this.valid.includes(event) && typeof callback === 'function') {
            this[event].push(callback);
        }
    }
    
    fire(event, ...args) {
        if (this.valid.includes(event) && this[event].length) {
            this[event].forEach(ev => {
                ev.call(this, ...args)
            }, this);
        }

    }
    
    divert(data, _dest, _dir, min) {
        let err = this.callErr();
        let { dest } = this.getPath(_dest, _dir);
        fs.appendFile(dest, data, err);
        if (min) {
            let mi = mini.minify(data);
            fs.writeFile(dest.replace('.' + this.ext, '.min.' + this.ext), mi, err);
        }
        return this;
    }
    
    getPath(dest, dir) {
        if (dir) {
            dir = path.resolve(this.root, dir);
            dest = path.resolve(dir, dest + '.' + this.ext);
        } else {
            dest = path.resolve(this.root, dest + '.' + this.ext);
        }
        return {
            dir:dir,
            dest:dest
        }
    }
    
    _write(dest, min, msgPath) {
        if (!this.stream) {
            let $this = this;
            this.stream = this.createStream(dest, min);
            let gen = $this.generate();
            $this.stream.on('pipe', function(read) {
                let stream = this;
                read.on('error', (err) => {
                    $this.err(err);
                    $this.end();
                
                });
                read.on('end', () => {
                    let f = gen.next().value;
                    if (f) {
                        fs.createReadStream(f, 'utf-8').pipe(stream, { end: false });
                    } else {
                        $this.end();
                        let msg = min ? 'Files written to ' + msgPath : 'File path is ' + msgPath;
                        console.info(msg); 
                        $this.fire('written');
                    }
                });
            });
            fs.createReadStream(gen.next().value, 'utf-8').pipe($this.stream, {end: false });
        }  else {
            console.warn('Stream already exists, call config.end() before creating a new stream');
        }
        return this;
    }
    
    write(_dest, _dir, min) {
        let $this = this;
        let p = '';
        let { dest, dir } = this.getPath(_dest, _dir);
        if (dir) {
            p = min ? dir : dest;
            exec('rm -rf "' + dir + '"', (err, out, errMsg) => {
                $this.err(err, out, errMsg);
                fs.mkdir(dir, () => {
                    $this._write(dest, min, p);
                    
                });
            });
        } else {
            $this._write(dest, min, dest);
        }
        return this;
    }
}

