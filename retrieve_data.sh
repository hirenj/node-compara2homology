#!/bin/bash

targetversion=$1
workdir=$2

ensembl_genomes_version=$(<"ensembl_genomes_version.txt")

mkdir -p $workdir/base

curl "ftp://ftp.ensembl.org/pub/release-${targetversion}/mysql/ensembl_compara_${targetversion}/seq_member.txt.gz" | gunzip | cut -f 1,2,4,5,7 - > $workdir/base/seq_member.txt
curl "ftp://ftp.ensembl.org/pub/release-${targetversion}/mysql/ensembl_compara_${targetversion}/family_member.txt.gz" | gunzip > $workdir/base/family_member.txt
curl "ftp://ftp.ensembl.org/pub/release-${targetversion}/mysql/ensembl_compara_${targetversion}/homology_member.txt.gz" | gunzip > $workdir/base/homology_member.txt


mkdir -p $workdir/pan

curl "ftp://ftp.ensemblgenomes.org/pub/pan_ensembl/release-${ensembl_genomes_version}/mysql/ensembl_compara_pan_homology_${ensembl_genomes_version}_${targetversion}/seq_member.txt.gz" | gunzip | cut -f 1,2,4,5,7 - > $workdir/pan/seq_member.txt
curl "ftp://ftp.ensemblgenomes.org/pub/pan_ensembl/release-${ensembl_genomes_version}/mysql/ensembl_compara_pan_homology_${ensembl_genomes_version}_${targetversion}/homology_member.txt.gz" | gunzip > $workdir/pan/homology_member.txt