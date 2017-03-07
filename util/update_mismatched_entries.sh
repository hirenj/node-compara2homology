#!/bin/sh

workdir=$1

#
# Reads N lines from input, keeping further lines in the input.
#
# Arguments:
#   $1: number N of lines to read.
#
# Return code:
#   0 if at least one line was read.
#   1 if input is empty.
#
function readlines () {
    local N="$1"
    local line
    local rc="1"

    # Read at most N lines
    for i in $(seq 1 $N)
    do
        # Try reading a single line
        read line
        if [ $? -eq 0 ]
        then
            # Output line
            echo $line
            rc="0"
        else
            break
        fi
    done

    # Return 1 if no lines where read
    return $rc
}


cp util/temporary_seq_member.sql $workdir

(cd $workdir; sqlite3 temporary_seq_member.db < temporary_seq_member.sql; rm $workdir/temporary_seq_member.sql)

database=$workdir/temporary_seq_member.db

uniprots_sql="select distinct stable_id from seq_member where sequence_id not in (select sequence_id from seq_member where source_name = 'ENSEMBLPEP') and (source_name = 'Uniprot/SWISSPROT' OR source_name = 'Uniprot/SPTREMBL') and taxon_id in ('9606','7227','6239','9823','10090','10116');";

echo "$uniprots_sql" | sqlite3 $database -csv > $workdir/missing_uniprot_ids

if [ -e uniprot_mappings.tsv ]; then
    cp uniprot_mappings.tsv $workdir/uniprot_mappings.tsv
fi

if [ ! -e $workdir/uniprot_mappings.tsv ]; then
	cat $workdir/missing_uniprot_ids | while idbatch=$(readlines 100)
	do
		echo "Retrieving entries for next 100 ids" 1>&2
		query_str=$(echo "$idbatch" | awk 'BEGIN { ORS="+OR+" } { print "accession:" $1}' | sed -e 's/+OR+$//')
		curl --retry-max-time 300 --retry 5 --retry-delay 0 --data "format=txt&query=$query_str" 'http://www.uniprot.org/uniprot/' | awk '$1 == "AC" { printf "\n" $2 "\t" } $1 == "OX" { printf $2 "\t" } $1 == "DR" && $2 ~ /Ensembl/ { printf $4 }' | tail -n+2;
		echo ""
	done > $workdir/new_idmappings.tsv
    awk -F' ' '$3 { print }' $workdir/new_idmappings.tsv  | sed -e 's/NCBI.*=//' > uniprot_mappings.tsv
    rm $workdir/new_idmappings.tsv
fi

rm $workdir/missing_uniprot_ids

awk -F $'\t' 'BEGIN{ counter=0 } { split($3,ensembls,";"); sub(/;/,"",$1); sub(/;/,"",$2); for( ensid in ensembls ) { if (ensembls[ensid]) { print "newseq" counter++ FS $1 FS "Uniprot/SWISSPROT" FS $2 FS ensembls[ensid] } } }' uniprot_mappings.tsv > new_rows.tsv

awk -F $'\t' '{ print  "select sequence_id,count(*) from seq_member where stable_id = \"" $5 "\";" }' new_rows.tsv | sqlite3 -csv $database | awk -F',' '$1 { print $1 } ! $1 { print "-1" }' > sequence_ids.tsv

cut -f 1-4 new_rows.tsv  | paste - sequence_ids.tsv | grep -v '\-1' > additional_seq_member.tsv

rm $workdir/uniprot_mappings.tsv
rm new_rows.tsv
rm sequence_ids.tsv
rm $database
