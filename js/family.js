"use strict";

const nconf = require('nconf');
const sqlite = require('sqlite3');
const PassThrough = require('stream').PassThrough;


let wanted_taxonomy = (nconf.get('taxonomy') || '').split(',').map( id => parseInt(id) );

let reference_taxonomies = [9606,10090,559292,284812].filter( id => wanted_taxonomy.indexOf(id) >= 0 );
let nonreference_taxonomies = [10029,10116,6239,7227,9823].filter( id => wanted_taxonomy.indexOf(id) >= 0 );

let swissprot_ids = reference_taxonomies.concat(nonreference_taxonomies).map( id => `'${id}'` ).join(',');
let trembl_ids = nonreference_taxonomies.map( id => `'${id}'` ).join(',');


let sql_query =
`SELECT family_id,stable_id,taxon_id,cigar_line
 FROM family_member INNER JOIN (
  SELECT seq_member_id,taxon_id,stable_id
  FROM seq_member
  WHERE (source_name = "Uniprot/SWISSPROT" AND taxon_id in (${swissprot_ids}) ) OR (source_name = "Uniprot/SPTREMBL" and taxon_id in (${trembl_ids}))
) USING(seq_member_id)
  ORDER BY family_id`;

let db = new sqlite.Database(nconf.get('database'));

let retrieve = function() {
  let rs = new PassThrough({ objectMode: true });
  db.each(sql_query,[], (err,row) => rs.push(row),
  () => {
    console.log("All done with SQL query");
    rs.end();
  } );
  return Promise.resolve(rs);
};


exports.retrieve = retrieve;