const base = require('./convene');

module.exports = class extends base {
    
    constructor(root) {
        super(root); 
    }
    
    _queue(src, dir) {
        let { loc } = super._queue(src, dir);
        let $this = this;
        let res = null;
        try {
            res = require(loc);
        } catch(e) {
            $this.fire('queueError', e);
        } finally {
            return res;
        }
        
    }    
}