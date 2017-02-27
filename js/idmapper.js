"use strict";

const stream = require('stream');
const util = require('util');
const csv = require('csv-parse');

const Transform = stream.Transform;
const PassThrough = stream.PassThrough;


let parse_mappings = function(rows) {
  let table = {};
  rows.forEach( (row) => {
    row[1].split(';').filter( id => id ).forEach(id => table[id] = row[0].replace(/;.*/,''));
  });
  return table;
};

function IdMapper(mappingfile) {
  // allow use without new
  if (!(this instanceof IdMapper)) {
    return new IdMapper(mappingfile);
  }

  var idfile = require('fs').readFileSync(mappingfile);
  this.ready = new Promise( (resolve,reject) => {
    csv(idfile,{delimiter: String.fromCharCode(0x9)}, (err,out) => {
      if (err) {
        reject(err);
      } else {
        resolve(out);
      }
    });
  }).then( (mappings) => this.mappings = parse_mappings(mappings) );

  Transform.call(this, {objectMode: true});
}

util.inherits(IdMapper, Transform);

IdMapper.prototype._transform = function (chunk, enc, cb) {
  let self = this;
  if (chunk.length < 2) {
    cb();
    return;
  }
  chunk.forEach( protein => {
    protein.stable_id = self.mappings[protein.stable_id];
  });
  let seen_ids = {};
  chunk = chunk.filter( protein => {
    if ( ! protein.stable_id ) {
      return false;
    }
    if (seen_ids[protein.stable_id]) {
      return false;
    }
    seen_ids[protein.stable_id] = true;
    return true;
  });
  if (chunk.length > 1) {
    this.push(chunk);
  }
  cb();
};

IdMapper.prototype._flush = function (cb) {
  cb();
};

exports.IdMapper = IdMapper;