'use strict';

const sqlite = require('sqlite3');

const nconf = require('nconf');

nconf.argv().env();

let base_db = new sqlite.Database(nconf.get('database'));

const csv = require('csv-parse');

const util = require('util');
const parse = require('csv-parse');

const Transform = stream.Transform;
const PassThrough = require('stream').PassThrough;

function Updater() {
  if (!(this instanceof Updater)) {
    return new Updater();
  }
  this.counter = 0;
  Transform.call(this, {objectMode: true});
}

util.inherits(Updater, Transform);

let get_seq_id = function(ensembl_id) {
  return query_db('SELECT sequence_id from seq_member where stable_id = ? ',[ensembl_id]).then( results => results[0].sequence_id );
};

let add_row = function(row) {
  return query_db("INSERT into seq_member(seq_member_id,stable_id,source_name,taxon_id,sequence_id) values(?,?,?,?,?)",[row.seq_member_id,row.stable_id,row.source_name,row.taxon_id,row.sequence_id]);
};

let query_db = function(query,params) {
  return new Promise( (resolve,reject) => {
    db.all(query,params, (err,rows) => {
      if (err) {
        console.log(err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

Updater.prototype._transform = function (row, enc, cb) {
  let self = this;
  let taxon = row[1].replace(/;/,'');
  let uniprot = row[0].replace(/;/g,'');
  let promises = row[2].split(';').map( ensid => {
    return get_seq_id(ensid).then( seqid => {
      return add_row( { sequence_id: seqid, taxon_id: taxon, stable_id: uniprot, seq_member_id: 'new_entry_'+self.counter++, source_name: 'Uniprot/SWISSPROT'  } );
    });
  });
  Promise.all(promises).then( cb );
};


let entry_stream = fs.createReadStream(nconf.get('input')).pipe(parse({delimiter: String.fromCharCode(0x9), relax_column_count: true }));

entry_stream.pipe(new Updater());