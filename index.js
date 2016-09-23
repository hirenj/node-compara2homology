"use strict";

const mysql = require('mysql');

let connection = mysql.createConnection({
  host     : 'ensembldb.ensembl.org',
  user     : 'anonymous',
  database : 'ensembl_compara_85'
});

const stream = require('stream');
const util = require('util');

const Transform = stream.Transform;
const PassThrough = stream.PassThrough;

const joiner = require('stream-stream');

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

function OrthologyGroup(options) {
  // allow use without new
  if (!(this instanceof OrthologyGroup)) {
    return new OrthologyGroup(options);
  }
  // init Transform
  Transform.call(this, options);
}
util.inherits(OrthologyGroup, Transform);

OrthologyGroup.prototype._transform = function (family_entry, enc, cb) {
  let family = family_entry[1];
  let self = this;
  let uniprots = family.map(entry => entry.uniprot);
  let taxonomies = family.map(entry => entry.taxonomy);
  let family_id = family_entry[0];
  let ortho_data = {'orthos' : uniprots, 'taxonomy' : taxonomies, 'family' : family_id };
  uniprots.forEach(function(uniprot) {
    self.push([uniprot, ortho_data]);
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

//mysql --host=ensembldb.ensembl.org --port=3306 --user=anonymous

let families = connection.query("select family_id,stable_id,taxon_id,cigar_line from family_member left join seq_member using (seq_member_id) where (seq_member.taxon_id in (9606,10090,559292,284812) and seq_member.source_name = 'Uniprot/SWISSPROT') union (select family_id,stable_id,taxon_id,cigar_line from family_member left join seq_member using (seq_member_id) where (seq_member.taxon_id in (10029,10116,6239,7227,9823) and seq_member.source_name = 'Uniprot/SPTREMBL' )) order by family_id")
  .stream()
  .pipe(new FamilyGroup({'objectMode' : true}));

let writer = new CheapJSON({});

writer.pipe(process.stdout);

families.pipe(new OrthologyGroup({'objectMode' : true})).pipe(writer);

families.pipe(writer);

writer.on('end', function () {
  process.exit(0);
});

