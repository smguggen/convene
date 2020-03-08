
module.exports = class {

    isReadable(src) {
        return typeof src === 'string' ||
            src instanceof Buffer ||
            src instanceof Uint8Array
    }
    
    err(...args) { 
        throw new Error(args.filter(arg => arg ? true : false).join(', '));
    }
    
    on(event, cb) {
        return this.events.on(event, cb);
    }
}