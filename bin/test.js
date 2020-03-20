#!/usr/bin/env node

const Convene = require('../src/convene');
const convene = new Convene();
convene.queue({ 'etc/a': ['a', 'b', 'c'], 'etc/b': ['d', 'e', 'f'] }, 'require', 'json');
convene.on('writing', (data) => data + '\n', true);
convene.on('queueError', function(e) {
    throw new Error(e);
});
convene.merge(process.cwd() + '/etc/result/convene.json', 'result');