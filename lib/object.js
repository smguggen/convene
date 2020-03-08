const Write = require('./write');

module.exports = class extends Write {
    
    constructor(parent, dest, ext, min) {
        super(parent, dest, ext, min);
        this.objectMode = true;
    }
}