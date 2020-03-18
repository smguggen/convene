#!/usr/bin/env node

const Convene = require('../src/convene');
const convene = new Convene(true);
convene.queue({ lib: ['util', 'events', 'data', 'headers', 'response'], src: ['request', 'get', 'post', 'delete', 'questal'] }, 'require');
convene.on('writing', (data) => data + '\n', true);
convene.on('queueError', function(e) {
    throw new Error(e);
});
convene.merge('questal', 'dist', true);