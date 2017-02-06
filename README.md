# Ensembl Compara to homology entries

Connects to the Ensembl Compara database server to retrieve the full set of family entries for homologous proteins. Data is split up so that it is easily indexable by the UniProt ID

## Distant species addition

```
ftp://ftp.ensemblgenomes.org/pub/pan_ensembl/release-34/mysql/ensembl_compara_pan_homology_34_87/

seq_member.txt.gz

homology_member.txt.gz

Do this analysis separately, and append the id-lists

http://www.uniprot.org/uniprot/?sort=score&desc=&compress=no&query=&fil=organism:6239&force=no&format=tab&columns=id,database(WormBase)
http://www.uniprot.org/uniprot/?sort=score&desc=&compress=no&query=&fil=organism:7227&force=no&format=tab&columns=id,database(FlyBase)

http://www.uniprot.org/uniprot/?sort=score&desc=&compress=no&query=&fil=organism:284812&force=no&format=tab&columns=id,database(PomBase)

http://www.uniprot.org/uniprot/?sort=score&desc=&compress=no&query=&fil=organism:559292&force=no&format=tab&columns=id,genes(OLN)
```
