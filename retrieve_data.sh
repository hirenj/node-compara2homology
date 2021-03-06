#!/bin/bash

targetversion=$1
workdir=$2

ensembl_genomes_version=$(<"ensembl_genomes_version.txt")

touch $workdir/idmappings.tsv

echo "Retrieving ID mappings for C Elegans"
curl --retry-max-time 300 --retry 5 --retry-delay 0 'http://www.uniprot.org/uniprot/?&compress=no&query=&fil=organism:6239&force=no&format=txt' | awk '$1 == "AC" { printf "\n" $2 "\t" } $1 == "DR" && $2 ~ /EnsemblMetazoa/ { printf $4 }' | tail -n+2 >> $workdir/idmappings.tsv
if [ $? -gt 0 ]; then exit 1; fi

echo "Retrieving ID mappings for Drosophila"
curl --retry-max-time 300 --retry 5 --retry-delay 0 'http://www.uniprot.org/uniprot/?&compress=no&query=&fil=organism:7227&force=no&format=txt' | awk '$1 == "AC" { printf "\n" $2 "\t" } $1 == "DR" && $2 ~ /EnsemblMetazoa/ { printf $4 }' >> $workdir/idmappings.tsv
if [ $? -gt 0 ]; then exit 1; fi

echo "Retrieving ID mappings for S Pombe"
curl --retry-max-time 300 --retry 5 --retry-delay 0 'http://www.uniprot.org/uniprot/?&compress=no&query=&fil=organism:284812&force=no&format=txt' | awk '$1 == "AC" { printf "\n" $2 "\t" } $1 == "DR" && $2 ~ /EnsemblFungi/ { printf $4 }' >> $workdir/idmappings.tsv
if [ $? -gt 0 ]; then exit 1; fi

echo "Retrieving ID mappings for Yeast"
curl --retry-max-time 300 --retry 5 --retry-delay 0 'http://www.uniprot.org/uniprot/?&compress=no&query=&fil=organism:559292&force=no&format=txt' | awk '$1 == "AC" { printf "\n" $2 "\t" } $1 == "DR" && $2 ~ /EnsemblFungi/ { printf $4 }' >> $workdir/idmappings.tsv
if [ $? -gt 0 ]; then exit 1; fi

echo "Retrieving InParanoid for CHO"
curl --retry-max-time 300 --retry 5 --retry-delay 0 'http://inparanoid.sbc.su.se/download/8.0_current/Orthologs_other_formats/C.griseus/InParanoid.C.griseus-M.musculus.tgz' > $workdir/inparanoid.cho.tgz
if [ $? -gt 0 ]; then exit 1; fi

tar -zxf $workdir/inparanoid.cho.tgz sqltable.C.griseus-M.musculus
if [ $? -gt 0 ]; then exit 1; fi

mv sqltable.C.griseus-M.musculus $workdir/sqltable.C.griseus-M.musculus

mkdir -p $workdir/base

echo "Retrieving seq_member for Ensembl Base"
curl --retry-max-time 300 --retry 5 --retry-delay 0 "ftp://ftp.ensembl.org/pub/release-${targetversion}/mysql/ensembl_compara_${targetversion}/seq_member.txt.gz" | gunzip | cut -f 1,2,4,5,7 - > $workdir/base/seq_member.txt
if [ $? -gt 0 ]; then exit 1; fi

# curl "ftp://ftp.ensembl.org/pub/release-${targetversion}/mysql/ensembl_compara_${targetversion}/family_member.txt.gz" | gunzip > $workdir/base/family_member.txt
# if [ $? -gt 0 ]; then exit 1; fi

echo "Retrieving homology_member for Ensembl Base"
curl --retry-max-time 300 --retry 5 --retry-delay 0 "ftp://ftp.ensembl.org/pub/release-${targetversion}/mysql/ensembl_compara_${targetversion}/homology_member.txt.gz" | gunzip > $workdir/base/homology_member.txt
if [ $? -gt 0 ]; then exit 1; fi

mkdir -p $workdir/pan

echo "Retrieving seq_member for Ensembl Pan"
curl --retry-max-time 300 --retry 5 --retry-delay 0 "ftp://ftp.ensemblgenomes.org/pub/pan_ensembl/release-${ensembl_genomes_version}/mysql/ensembl_compara_pan_homology_${ensembl_genomes_version}_${targetversion}/seq_member.txt.gz" | gunzip | cut -f 1,2,4,5,7 - > $workdir/pan/seq_member.txt
if [ $? -gt 0 ]; then exit 1; fi

echo "Retrieving homology_member for Ensembl Pan"
curl --retry-max-time 300 --retry 5 --retry-delay 0 "ftp://ftp.ensemblgenomes.org/pub/pan_ensembl/release-${ensembl_genomes_version}/mysql/ensembl_compara_pan_homology_${ensembl_genomes_version}_${targetversion}/homology_member.txt.gz" | gunzip > $workdir/pan/homology_member.txt
if [ $? -gt 0 ]; then exit 1; fi
