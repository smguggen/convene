#!/usr/bin/env node

const Convene = require('../src/require');
const config = new Convene();
config.queue(['util', 'events', 'data', 'headers', 'response'], 'lib');
config.queue(['request', 'get', 'post', 'delete', 'questal'], 'src');
config.on('queueError', function(e) {
    console.log('Queue Error', e);
})
config.write('questal', 'dist', true, true);

