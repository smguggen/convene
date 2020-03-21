#!/usr/bin/env node

const Convene = require('../src/convene');
const convene = new Convene();
convene.queue({ 'etc/a': ['a']}, 'require', 'json');

convene.queue({ 'etc/a': ['b', 'c'], 'etc/b': ['d', 'e', 'f'] }, 'require', 'json');

convene.on('writing', (data) => data + '\n', true);
convene.merge(process.cwd() + '/etc/result/convene.json', 'result');
convene.on('clear', () => {
    let c = convene.requeue('ternal', 'require');
    c.merge(process.cwd() + '/etc/result/convene.js', true);
});
