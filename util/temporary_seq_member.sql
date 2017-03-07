PRAGMA journal_mode = OFF;

CREATE TABLE seq_member(seq_member_id,stable_id,source_name,taxon_id,sequence_id);

.mode tabs
.separator '	'
.import seq_member.txt seq_member

CREATE index stable_id_idx on seq_member(stable_id);
CREATE index sequence_id_source_idx on seq_member(sequence_id,source_name);