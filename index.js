"use strict";

const stream = require('stream');
const path = require('path');
const fs = require('fs');
const nconf = require('nconf');
const mkdirp = require('mkdirp');

const FamilyGroup = require('./groupers').FamilyGroup;
const HomologyGroup = require('./groupers').HomologyGroup;

const CheapJSON = require('./output').CheapJSON;

nconf.argv().env();


let families = new FamilyGroup();

require('./homology').retrieve().then( stream => stream.pipe(families) );

// require('./family').retrieve().then( stream => stream.pipe(families) );

let ensembl_release = 'ensembl_compara_'+( nconf.get('version') || '85');

let writer = new CheapJSON({ 'mimetype' : 'application/json+homology', 'title' : 'Homology', 'version' : ensembl_release });

let alignment_writer = new CheapJSON({'mimetype' : 'application/json+homology_alignment', 'title' : 'Homology Alignments', 'version' : ensembl_release });

let homology_file = families
.pipe(new HomologyGroup())
.pipe(writer)
.pipe(fs.createWriteStream('homology.json'));

let homology_alignment_file = families
.pipe(alignment_writer)
.pipe(fs.createWriteStream('homology_alignment.json'));

let homology_promise = new Promise(function(resolve,reject) {
  homology_file.on('close', resolve);
  writer.on('error', reject);
});

let alignment_promise = new Promise(function(resolve,reject) {
  homology_alignment_file.on('close', resolve);
  alignment_writer.on('error', reject);
});

Promise.all([homology_promise,alignment_promise]).then( () => console.log('Wrote homology groups') || process.exit(0) ).catch( (err) => console.log('ERROR',err) || process.exit(1) );
