"use strict";

const JSONStream = require('JSONStream');
const nconf = require('nconf');
const fs = require('fs');
const Aligner = require('./js/aligner').Aligner;

const CheapJSON = require('./js/output').CheapJSON;

nconf.argv().env();

const get_input_json_stream = function() {
  return fs.createReadStream(nconf.get('input')).pipe(JSONStream.parse('data.*'));
};

let stream  = get_input_json_stream();

let ensembl_release = 'ensembl_compara_'+( nconf.get('version') || '85');

let alignment_writer = new CheapJSON({'mimetype' : 'application/json+homology_alignment', 'title' : 'Homology Alignments', 'version' : ensembl_release });
stream.pipe(new Aligner(nconf.get('database'))).pipe(alignment_writer).pipe(fs.createWriteStream(nconf.get('output') || 'homology_alignment.json'));

