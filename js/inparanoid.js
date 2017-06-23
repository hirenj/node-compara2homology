"use strict";

const stream = require('stream');
const util = require('util');
const parse = require('csv-parse');

const Transform = stream.Transform;
const PassThrough = require('stream').PassThrough;

const Parser = function() {
  let input_stream = new PassThrough();
  let tsv_stream = input_stream.pipe(parse({delimiter: String.fromCharCode(0x9), relax_column_count: true }));
  let grouped_stream = tsv_stream.pipe(new Grouper());
  input_stream.output = grouped_stream;
  return input_stream;
};

function Grouper() {
  if (!(this instanceof Grouper)) {
    return new Grouper();
  }
  this.last_id = null;
  this.group = [];
  Transform.call(this, {objectMode: true});
}

util.inherits(Grouper, Transform);

Grouper.prototype.row_grouper = function(row) {
  if (row.family_id !== this.last_id) {
    if (this.group.length > 0) {
      this.push(this.group);
    }
    this.last_id = row.family_id;
    this.group = [];
  }
  this.group.push(row);
};

Grouper.prototype._transform = function (row, enc, cb) {
  if ( ! row[5] ) {
    cb();
    return;
  }
  let taxon_string = row[2];
  let taxon = 0;
  switch (taxon_string) {
    case 'C.griseus':
      taxon = '10029';
      break;
    case 'H.sapiens':
      taxon = '9606';
      break;
    case 'M.musculus':
      taxon = '10090';
      break;
    case 'R.norvegicus':
      taxon = '10116';
      break;
    case 'S.scrofa':
      taxon = '9823'
  }
  this.row_grouper({ taxon_id : +taxon, stable_id : row[4], family_id : 'inparanoid_'+row[0] });
  cb();
};

Grouper.prototype._flush = function (cb) {
  this.push(this.group);
  cb();
};


exports.Parser = Parser;