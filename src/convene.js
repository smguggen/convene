const fs = require('fs');
const path = require('path');
const { Writable } = require('stream');
const Config = require('./index');

module.exports = class extends Config {
    
    constructor(root, ext) {
       super(root, ext);
    }
    
    createStream(dest, min) {
        let stream = new Writable({ 
            objectMode: true, 
            write: (chunk, encoding, callback) => {
                callback = typeof callback === 'function' ? callback : () => {}
                fs.appendFile(dest, chunk + '\n', callback);
            } 
        });
        if (min) {
            this.min(stream);
        }
        stream.on('error', this.callErr());
        stream.path = dest;
        return stream;
    }

    
    add(files, src) {
        let $this = this;
        if (typeof files === 'string') {
            files = [files];
        }
        let root = src ? path.resolve(this.root, src) : this.root;
        let f = files.reduce((acc, file) => {
            let loc = path.join(root, file + '.' + $this.ext);
            if (fs.existsSync(loc)) {
                let obj = require(loc);
                if (obj) {
                    acc.push(obj);
                }
            }
            return acc;
        }, []);
        if (f && f.length) {
            this.toWrite = this.toWrite.concat(f);
        }
        return this;
    }
    
    _write(dest, min, msgPath) {
        if (!this.stream) {
            let $this = this;
            this.stream = $this.createStream(dest, min);
            this.stream.on('end', () => {
                $this.reset();
                let msg = min ? 'Objects written to ' + msgPath : 'File path is ' + msgPath;
                console.info(msg); 
                $this.fire('written');
            });
            let gen = $this.generate();
            let d = gen.next().value;
            while (d) {
                let res = this.stream.write(d);
                if (!res) {
                    $this.stream.once('drain', () => { 
                        d = gen.next().value;
                    });
                } else {
                    d = gen.next().value;
                }
            }
            this.end();
            let msg = min ? 'Objects written to ' + msgPath : 'File path is' + msgPath;
            console.info(msg); 
            $this.fire('written');
            
        } else {
            console.warn('Stream already exists, call config.end() before creating a new stream');
        }
        return this;
    }
}

