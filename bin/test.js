#!/usr/bin/env node

const Convene = require('../src/convene');
const convene = new Convene({
    ext:'json'
});
convene.require(['a', 'b', 'c'], 'etc/a');
convene.require(['d', 'e', 'f'], 'etc/b');
convene.on('writing', (data) => data + '\n', true);
convene.on('queueError', function(e) {
    throw new Error(e);
});
convene.merge('convene', 'etc/result');