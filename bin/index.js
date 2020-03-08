#!/usr/bin/env node

const Convene = require('../src/convene');
const convene = new Convene(true);
convene.require(['a', 'b', 'c'], 'a');
convene.require(['d', 'e', 'f'], 'b');
convene.on('writing', (data) => data + '\n', true);
convene.on('queueError', function(e) {
    throw new Error(e);
});
convene.merge('convene', 'etc/result');