#!/usr/bin/env node

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

const Convene = require('../src/convene');
const convene = new Convene();

//convene.json(['a', 'b', 'c'], 'etc/a');
//convene.json(['d', 'e', 'f'], 'etc/b');
convene.json({
    'etc/a': '*',
    'etc/b': '*'
});
//convene.on('writing', data => data + ',');

convene.on('queueError', function(e) {
    throw new Error(e);
});

convene.on('merged', (con) => {

   /* console.log('Merge Firing');
    let root = process.cwd();

    let key = fs.readFileSync(path.resolve(root, 'etc/key.js'));
    let minKey = fs.readFileSync(path.resolve(root, 'etc/key.min.js'));
    let res = fs.readFileSync(path.resolve(root, 'etc/result/convene.js'));
    let minRes = fs.readFileSync(path.resolve(root, 'etc/result/convene.min.js'));

    console.log(assert.equal(res, key, 'Files do not match'));
    console.log(assert.equal(minRes, minKey, 'Minified Files do not match'));*/
});


convene.merge('convene', 'etc/result');
