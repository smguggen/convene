#!/usr/bin/env node

const Convene = require('../src/convene');
const config = new Convene(true);
config.require(['util', 'events', 'data', 'headers', 'response'], 'lib');
config.require(['request', 'get', 'post', 'delete', 'questal'], 'src');
config.on('writing', (data) => data + '\n', true);
config.on('queueError', function(e) {
    console.log('Queue Error', e);
});
config.send('questal', 'dist', true, true);

