const Events = require('./events');

class Config {
    constructor(options) {
        let root = process.cwd();
        let rte = path.resolve(root, 'convene.config');
        let config = {};
        if (fs.existsSync(rte + '.js')) {
            config = require(rte);
        } else if (fs.existsSync(rte + '.json')) {
            config = require(rte + '.json');
        }
        let defaults = {
            root: process.cwd(),
            dest: null,
            dir: '.',
            ext: 'js',
            min: false,
            enc:'utf-8',
            timeout: null
        }
        config = Object.assign({}, defaults,  config, (options || {}));
        for (let c in config) {
            if (config.hasOwnProperty(c)) {
                this[c] = config[c];
            }
        }
        this.events = new Events();
    }
}

module.exports = new Config();