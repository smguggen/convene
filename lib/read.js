const Base = require('./base');
const { Readable, Writable } = require('stream');


module.exports = class extends Base {
    constructor(parent, src, encoding) {
        super();
        this.parent = parent;
        this.src = src;
        this.encoding = encoding || 'utf8';
    }
    
    start(pipeTo, src) {
        let opt = { end: false };
        let readable = this.isReadable(src);
        if (src && readable && pipeTo instanceof Writable) {
            let stream = this.stream;
            return stream.pipe(pipeTo, opt);
        } else {
            let msg;
            if (!src) {
                msg = 'Read Source not found';
            } else if (!readable) {
                msg = 'Read Source not readable';
            } else if (!(pipeTo instanceof Writable)) {
                msg = 'No Writable Stream. Read Stream can only pipe to Writable Stream.'
            }
            this.parent.events.fire('error', msg);
        }
    }
    
    get stream() {
        if (!this.src) {
            return this.err('No read source found');
        }
        let $this = this;
        let options = {
            encoding:$this.encoding,
            read: function(size) {
                let res = $this.events.fire('reading', $this.src, size);
                res = res ? res : $this.src;
                if ($this.isReadable(res)) {
                    let d;
                    do {
                        d = this.push(res, $this.encoding);
                    } while(d);
                    this.push(null);
                } else {
                    $this.err('Source not readable');
                }
                console.log('done reading...');
            } 
        }
        return new Readable(options);
    }
}