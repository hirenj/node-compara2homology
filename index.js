"use strict";

const mysql = require('mysql');

const stream = require('stream');
const util = require('util');
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');

const Transform = stream.Transform;
const PassThrough = stream.PassThrough;

let ensembl_release = 'ensembl_compara_85';
let reference_taxonomies = [9606,10090,559292,284812];
let nonreference_taxonomies = [10029,10116,6239,7227,9823];

let connection = mysql.createConnection({
  host     : 'ensembldb.ensembl.org',
  user     : 'anonymous',
  database : ensembl_release
});

function FamilyGroup(options) {
  // allow use without new
  if (!(this instanceof FamilyGroup)) {
    return new FamilyGroup(options);
  }
  this.entries = [];
  // init Transform
  Transform.call(this, options);
}
util.inherits(FamilyGroup, Transform);

FamilyGroup.prototype._transform = function (chunk, enc, cb) {
  if (this.last_family && chunk.family_id !== this.last_family) {
    if (this.entries.length > 1) {
      this.push(["fam"+this.last_family, [].concat(this.entries)]);
    }
    this.entries.length = 0;
  }
  this.entries.push({ 'uniprot' : chunk.stable_id, 'cigar' : chunk.cigar_line, 'taxonomy' : chunk.taxon_id });
  this.last_family = chunk.family_id;
  cb();
};

FamilyGroup.prototype._flush = function (cb) {
  if (this.entries.length > 1) {
    this.push(["fam"+this.last_family, [].concat(this.entries)]);
  }
  this.entries.length = 0;
  cb();
};

function HomologyGroup(options) {
  if (!(this instanceof HomologyGroup)) {
    return new HomologyGroup(options);
  }
  Transform.call(this, options);
}

util.inherits(HomologyGroup, Transform);

HomologyGroup.prototype._transform = function (family_entry, enc, cb) {
  let family = family_entry[1];
  let self = this;
  let uniprots = family.map(entry => entry.uniprot);
  let taxonomies = family.map(entry => entry.taxonomy);
  let family_id = family_entry[0];
  let homology_data = {'homology' : uniprots, 'taxonomy' : taxonomies, 'family' : family_id };
  uniprots.forEach(function(uniprot) {
    self.push([uniprot, homology_data]);
  });
  cb();
};

function CheapJSON(meta,options) {
  if (!(this instanceof CheapJSON)) {
    return new CheapJSON(meta,options);
  }

  if (!options) options = {};
  options.objectMode = true;
  this.meta = meta;
  this.first = false;
  Transform.call(this, options);
}

util.inherits(CheapJSON, Transform);

CheapJSON.prototype._transform = function (obj,enc,cb) {
  let sep = ',';
  if (! this.first) {
    sep = '{\n"data":{';
  }
  this.first = this.first || true;
  this.push(sep+'\n\t"'+obj[0]+'":'+JSON.stringify(obj[1]));
  cb();
};

CheapJSON.prototype._flush = function(cb) {
  this.push('\n},\n"metadata":'+JSON.stringify(this.meta)+'\n}\n');
  cb();
};

function FamilyJSON(basepath,options) {
  if (!(this instanceof FamilyJSON)) {
    return new FamilyJSON(basepath,options);
  }
  this.base = basepath;
  Transform.call(this, options);
}

util.inherits(FamilyJSON, Transform);

FamilyJSON.prototype._transform = function (family_entry, enc, cb) {
  let family = family_entry[1];
  let family_id = family_entry[0];
  fs.writeFile( path.join(this.base,family_id), JSON.stringify(family), function() {} );
  cb();
};

let families = connection.query('select family_id,stable_id,taxon_id,cigar_line from family_member left join seq_member using (seq_member_id) where (seq_member.taxon_id in ('+reference_taxonomies.join(',')+') and seq_member.source_name = "Uniprot/SWISSPROT") union (select family_id,stable_id,taxon_id,cigar_line from family_member left join seq_member using (seq_member_id) where (seq_member.taxon_id in ('+nonreference_taxonomies.join(',')+') and seq_member.source_name = "Uniprot/SPTREMBL" )) order by family_id')
  .stream()
  .pipe(new FamilyGroup({'objectMode' : true}));

let writer = new CheapJSON({ 'mimetype' : 'application/json+homology', 'title' : 'Homology', 'version' : ensembl_release });

let alignment_writer = new CheapJSON({'mimetype' : 'application/json+homology_alignment', 'title' : 'Homology Alignments', 'version' : ensembl_release });

families
.pipe(new HomologyGroup({'objectMode' : true}))
.pipe(writer)
.pipe(fs.createWriteStream('homology.json'));

families
.pipe(alignment_writer)
.pipe(fs.createWriteStream('homology_alignment.json'));

let homology_promise = new Promise(function(resolve,reject) {
  writer.on('end', resolve);
  writer.on('error', reject);
});

let alignment_promise = new Promise(function(resolve,reject) {
  alignment_writer.on('end', resolve);
  alignment_writer.on('error', reject);
});

Promise.all([homology_promise,alignment_promise]).then( () => process.exit(0) ).catch( () => process.exit(1) );
