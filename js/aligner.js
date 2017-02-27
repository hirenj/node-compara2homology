"use strict";

const stream = require('stream');
const util = require('util');
const clustal = require('node-clustal');
const sqlite = require('sqlite3');

const Transform = stream.Transform;

function Aligner(db_path) {
  if (!(this instanceof Aligner)) {
    return new Aligner(db_path);
  }
  // Start at 2 because the entries we get out start at 2..
  this.start_familyid = 2;
  this.cached_entries = [];
  this.waiting_proteins = [];
  init(db_path);
  Transform.call(this, {objectMode: true});
}
util.inherits(Aligner, Transform);

Aligner.prototype._transform = function (chunk, enc, cb) {
  this.cached_entries.push( { 'family' : this.start_familyid++, entries: chunk }  );
  this.waiting_proteins = this.waiting_proteins.concat(  chunk.map( entry => entry.uniprot ) );

  if (this.waiting_proteins.length >= 500) {
    this.run_alignments(cb);
  } else {
    cb();
  }
};

Aligner.prototype._flush = function (cb) {
  this.run_alignments(cb);
};

let promise_each = function(db,query,callback) {
  if ( ! callback ) {
    callback = function() {};
  }
  return new Promise( (resolve,reject) => {
    db.each(query,[], (err,row) => {
      if (err) {
        console.log(err);
        reject(err);
      } else {
        callback(row);
      }
    },resolve);
  });
};


let populate_sequences = function(groups,sequences) {
  groups.forEach( group => {
    group.entries.forEach( prot => {
      if ( ! sequences[prot.uniprot]) {
        console.error("No sequence for ",prot.uniprot);
      }
      prot.sequence = sequences[prot.uniprot];
    });
  });
};

let db = null;

let init = function(db_path) {
  db = new sqlite.Database(db_path);
};

let get_sequences_sqlite = function(ids) {
  let result = {};
  let ids_string = ids.map( id => `'${id}'`).join(',');
  return promise_each(db,`select * from sequence where uniprot in (${ids_string})`, (seq) => {
    result[seq.uniprot] = seq.sequence;
  }).then( () => result );
};

let get_sequences_fetch = function(ids,retries) {
  const fetch = require('node-fetch');
  let query_body = "format=tab&columns=id,sequence&query=";
  query_body += ids.map( id => `accession%3A${id}` ).join('+OR+');
  if (retries > 5) {
    throw new Error("Could not get entries after 5 retries");
  }
  console.log("Trying to retrieve UniProt sequences for",ids.length,"sequences starting at ",ids[0]);
  console.time("sequenceRetrieve");
  return fetch('http://www.uniprot.org/uniprot/',{ method: 'POST', body: query_body, headers: { 'Content-Type': 'application/x-www-form-urlencoded'} })
  .then( res => res.text() )
  .then( body => {
    console.log("Got back sequences");
    console.timeEnd("sequenceRetrieve");
    let result = {};
    body.split('\n').forEach( res => {
      let seq_bits = res.split('\t');
      result[seq_bits[0]] = seq_bits[1];
    });
    return result;
  }).catch( err => {
    console.error(err);
    return get_sequences(ids,(retries || 0)+1);
  });
};

let get_sequences = get_sequences_sqlite;

let make_cigar = function(aligned) {
  aligned = aligned.replace(/([^-]+)/g, match => { return (( match.length > 1 ? match.length : '' )+ 'M'); });
  aligned = aligned.replace(/(-+)/g,match => { return (( match.length > 1 ? match.length : '' )+ 'D'); });
  return aligned;
};

let do_alignment = function(group) {
  let seq_info = {};
  let entry_count = 0;
  group.entries.filter( entry => entry.sequence ).forEach(  entry  => {
    seq_info[entry.uniprot] = entry.sequence;
    entry_count++;
  });
  let result = {};

  if (entry_count >= 2) {
    result = clustal.clustalo(seq_info,{sequenceType: clustal.SEQTYPE_PROTEIN });
  }

  group.entries.forEach(  entry  => {
    delete entry.sequence;
    if (result[entry.uniprot]) {
      entry.cigar_line = make_cigar(result[entry.uniprot]);
    }
  });
};

let execute_alignments = function(groups) {
  console.log(groups.length,"families to be aligned");
  console.time("align");
  groups.forEach( group => do_alignment(group) );
  console.timeEnd("align");
  return groups;
}

Aligner.prototype.run_alignments = function(cb) {
  console.log("Starting a new batch",new Date());
  return get_sequences(this.waiting_proteins)
  .then(populate_sequences.bind(null,this.cached_entries))
  .then( () => {
    let populated_entries = [].concat(this.cached_entries);
    this.waiting_proteins.length = 0;
    this.cached_entries.length = 0;
    return populated_entries
  })
  .then(execute_alignments)
  .then( (groups) => {
    groups.map( entry => {
      return [ 'fam'+entry.family, entry.entries ];
    }).forEach( entry => this.push(entry) );
  })
  .then( () => {
    cb();
  })
  .catch( err => console.error(err,err.stack));
};

exports.Aligner = Aligner;