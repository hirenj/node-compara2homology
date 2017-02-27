"use strict";

const nconf = require('nconf');
const sqlite = require('sqlite3');
const path = require('path');
const PassThrough = require('stream').PassThrough;
const GroupMaker = require('./groupers').GroupMaker;
const Expander = require('./expander').Expander;
const IdMapper = require('./idmapper').IdMapper;
const fs = require('fs');

let wanted_taxonomy = (nconf.get('taxonomy') || '').split(',').map( id => parseInt(id) );

let reference_taxonomies = [9606,10090,559292,284812].filter( id => wanted_taxonomy.indexOf(id) >= 0 );
let nonreference_taxonomies = [10029,10116,6239,7227,9823].filter( id => wanted_taxonomy.indexOf(id) >= 0 );

let swissprot_ids = reference_taxonomies.concat(nonreference_taxonomies).map( id => `'${id}'` ).join(',');
let trembl_ids = nonreference_taxonomies.map( id => `'${id}'` ).join(',');

let sql_query =
`
SELECT homology_id as family_id,stable_id,taxon_id
FROM seq_member JOIN (
  SELECT sequence_id,homology_id,perc_id
  FROM homology_member JOIN (
    SELECT *
    FROM seq_member
    WHERE taxon_id in (${swissprot_ids},${trembl_ids}) and source_name = 'ENSEMBLPEP'
  ) as all_seqs USING(seq_member_id)
) USING(sequence_id)
WHERE (source_name = 'Uniprot/SWISSPROT' OR source_name = 'Uniprot/SPTREMBL')
AND taxon_id in (${swissprot_ids},${trembl_ids})
AND perc_id >= 30
ORDER BY homology_id
`;

let sql_query_pan =
`
SELECT homology_id as family_id,stable_id,taxon_id
FROM seq_member JOIN (
  SELECT sequence_id,homology_id,perc_id
  FROM homology_member JOIN (
    SELECT *
    FROM seq_member
    WHERE taxon_id in (${swissprot_ids},${trembl_ids}) and source_name = 'ENSEMBLPEP'
  ) as all_seqs USING(seq_member_id)
) USING(sequence_id)
WHERE taxon_id in (${swissprot_ids},${trembl_ids})
AND perc_id >= 30
ORDER BY homology_id
`;

let base_db_path = nconf.get('database');

let pan_db_path = path.normalize(path.join(path.dirname(base_db_path),'..','pan',path.basename(base_db_path)));
let pan_ids_path = path.normalize(path.join(path.dirname(base_db_path),'..', 'idmappings.tsv' ));

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
}

let retrieve_ids = function(db,is_pan) {
  let rs = new PassThrough({ objectMode: true });
  let last_id = null;
  let group = [];
  let row_grouper = function(row) {
    if (row.family_id !== last_id) {
      if (group.length > 0) {
        rs.push(group);
      }
      last_id = row.family_id;
      group = [];
    }
    group.push(row);
  };
  promise_each(db,is_pan ? sql_query_pan : sql_query,row_grouper).then( () => {
    rs.end();
  });
  return Promise.resolve(rs);
};

let wait_for_stream = function(stream,label) {
  let count = 0;
  stream.on('data', () => {
    if ((count % 100000) == 0) {
      console.log(label,count,"records retrieved");
    }
    count++;
  });

  return new Promise((resolve,reject) => {
    stream.on('end',resolve);
    stream.on('error',reject);
  });
}

let base_retrieve = function(group_maker) {
  let base_db = new sqlite.Database(base_db_path);
  return retrieve_ids(base_db)
         .then( stream => {
          console.log("Base DB ready, retrieving records");
          stream.pipe(group_maker,{end: false});
          return wait_for_stream(stream,"Base");
        });
};

let pan_retrieve = function(group_maker) {
  let id_mapper = new IdMapper(pan_ids_path);
  id_mapper.pipe(group_maker);
  return id_mapper.ready
         .then( () => console.log("ID mapper ready, retrieving pan entries"))
         .then( () => retrieve_ids(new sqlite.Database(pan_db_path),"pan") )
         .then( stream => {
          stream.pipe(id_mapper,{end: false});
          return wait_for_stream(stream,"Pan");
        });
};

let read_inparanoid_data = function(sqltable_file) {
  return new Promise( (resolve) => {
    let table_parser = require('./inparanoid').Parser();
    let out_stream = table_parser.output;
    fs.createReadStream(sqltable_file).pipe(table_parser);
    resolve(out_stream);
  });
};


let cho_retrieve = function(group_maker) {
  return read_inparanoid_data(nconf.get('cho_sqltable')).then( stream => {
    stream.pipe(group_maker, {end: false});
    return wait_for_stream(stream,"CHO");
  });
};

let retrieve = function() {
  let group_maker = new GroupMaker();
  let expander = new Expander();

  group_maker.pipe(expander);

  Promise.resolve()
    .then( () => base_retrieve(group_maker) )
    .then( () => console.log("Retrieved base data") )
    .then( () => pan_retrieve(group_maker) )
    .then( () => console.log("Retrieved pan data") )
    .then( () => cho_retrieve(group_maker) )
    .then( () => console.log("Retrieved CHO data") )
    .then( () => group_maker.end() );

  return Promise.resolve(expander);
  // We should spit out a stream with:
  // family_id, stable_id, cigar_line, taxon_id

};


exports.retrieve = retrieve;