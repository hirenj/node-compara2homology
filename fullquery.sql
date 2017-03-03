SELECT homology_id as family_id,stable_id,taxon_id,perc_id,perc_cov,perc_pos
FROM seq_member JOIN (
   SELECT sequence_id,homology_id,perc_id,perc_cov,perc_pos
      FROM homology_member JOIN (
           SELECT * FROM seq_member
             WHERE taxon_id in ('9606','7227','6239','9823','10090','10116') and source_name = 'ENSEMBLPEP'
        ) as all_seqs USING(seq_member_id)
      ) USING(sequence_id)
WHERE
 (source_name = 'Uniprot/SWISSPROT' OR source_name = 'Uniprot/SPTREMBL')
  AND taxon_id in ('9606','7227','6239','9823','10090','10116')
  AND perc_id >= 30
ORDER BY homology_id;