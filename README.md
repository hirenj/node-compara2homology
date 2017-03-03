# Ensembl Compara to homology entries

Connects to the Ensembl Compara database server to retrieve the full set of family entries for homologous proteins. Data is split up so that it is easily indexable by the UniProt ID

## Debugging entries from the database
```
sqlite3 -csv -header compara.db < fullquery.sql > fullquery_reduced_output.csv
(wanted=P12345; for other in $idlist; do grep -F -f <(grep -B10 -A10 $wanted fullquery_reduced_output.csv | grep "$wanted\|$other" | awk -F',' '{ print $1 FS $2 }' | sort -u | awk -F',' '{ print $1 }' | awk 'c[$0]++; c[$0]==2' | uniq) fullquery_reduced_output.csv; done);
```