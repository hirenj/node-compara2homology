'use strict';

const fs = require('fs');
const Gunzip = require('zlib').Gunzip;
const tabular = require('tabular-stream');
const snake = require('snake-case');
const util = require('util');
const Transform = require('stream').Transform;

let gzipped = fs.createReadStream('compara87_orthology.csv.gz');

function BytesRead(options) {
  // allow use without new
  if (!(this instanceof BytesRead)) {
    return new BytesRead(options);
  }
  if ( ! options ) {
    options = {};
  }
  Transform.call(this, options);
}
util.inherits(BytesRead, Transform);

BytesRead.prototype._transform = function (obj, enc, cb) {
  this.bytesread = (this.bytesread || 0) + obj.length;
  this.push(obj);
  cb();
};

/* Streaming transform of JSON objects using the given template
   calling functions from the given environment if necessary
 */
function ObjectTransform(options) {
  // allow use without new
  if (!(this instanceof ObjectTransform)) {
    return new ObjectTransform(options);
  }
  if ( ! options ) {
    options = {};
  }
  options.objectMode = true;
  Transform.call(this, options);
}
util.inherits(ObjectTransform, Transform);

ObjectTransform.prototype._transform = function (obj, enc, cb) {
  if (obj.homology_id !== this.last_id) {
    if (this.group && this.group.length > 1) {
      this.push(this.group);
    }
    this.group = [];
    this.last_id = obj.homology_id;
  }
  this.group.push(obj);
  cb();
};

var id_maps = {};

let bytesread = new BytesRead();

// A => [A,B,D], B => [A,B,D] ,D => [A,B,D]

// New C,D,E

// C

// A => [A,B,D], B => [A,B,D], C => [C,D,E], D => [A,B,D]

// D

// Existing group for D - add in C,D,E to each member

// A => [A,B,C,D,E], B => [A,B,C,D,E], C => [C,D,E], D => [A,B,C,D,E] 

// No

gzipped.pipe(bytesread).pipe(new Gunzip()).pipe(tabular(snake)).pipe(new ObjectTransform()).on('data',(dat) => {
  let ids = dat.map( (obj) => obj.stable_id );
  let insert_list = [].concat(ids);

  ids.forEach( (id) => {
    if ( ! id_maps[id] ) {
      id_maps[id] = [];
    } else {
      id_maps[id].forEach( (existing) => {
        if ( id_maps[existing].indexOf(id) < 0) {
          id_maps[existing].push(id);
        }
      });
    }
    insert_list.forEach( (a_id) => {
      if (id_maps[id].indexOf(a_id) < 0) {
        id_maps[id].push(a_id);
      }
      id_maps[id]
    });
    console.log(bytesread.bytesread);
  });
}).on('end', () => {
  // fs.writeFile('id_maps.json',JSON.stringify(id_maps), () => console.log("Done"));
});

