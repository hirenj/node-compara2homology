#!/bin/bash

workdir=$1

cp sqlcommands $workdir/base
cp sqlcommands-test $workdir/base
cp sqlcommands $workdir/pan
cp sqlcommands-test $workdir/pan

cd $workdir/base

if [ ! -e family_member.txt ]; then
	touch family_member.txt
fi

head -10 seq_member.txt > seq_member_short.txt
head -10 family_member.txt > family_member_short.txt

sqlite3 compara.db < sqlcommands-test
sqlite3 compara.db 'select seq_member_id,stable_id from seq_member'

rm compara.db

sqlite3 compara.db < sqlcommands
if [ $? -gt 0 ]; then exit 1; fi

rm seq_member.txt
rm homology_member.txt
rm family_member.txt

cd $workdir/pan

if [ ! -e family_member.txt ]; then
	touch family_member.txt
fi

head -10 seq_member.txt > seq_member_short.txt
head -10 family_member.txt > family_member_short.txt

sqlite3 compara.db < sqlcommands-test
sqlite3 compara.db 'select seq_member_id,stable_id from seq_member'

rm compara.db

sqlite3 compara.db < sqlcommands
if [ $? -gt 0 ]; then exit 1; fi

rm seq_member.txt
rm homology_member.txt
rm family_member.txt