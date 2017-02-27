#!/bin/bash

targetversion=$1
workdir=$2

for tax in 559292 9606 10090 284812 10029 10116 6239 7227 9823; do
	curl "http://www.uniprot.org/uniprot/?query=organism%3A$tax&format=tab&columns=id,sequence" > $workdir/$tax.seq.tsv;
	if [ $? -gt 0 ]; then exit 1; fi
done

cd $workdir

for file in *.seq.tsv; do tail -n+2 $file; done > sequences.tsv

rm *.seq.tsv

sqlite3 sequences.db < seqdbcommands

rm sequences.tsv