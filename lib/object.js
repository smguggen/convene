const Write = require('./write');

module.exports = class extends Write {
    
    constructor(dest, min) {
        super(dest, min);
        this.objectMode = true;
    }
}