#!/bin/bash

workdir=$1

cp sqlcommands $workdir
cp sqlcommands-test $workdir

cd $workdir

head -10 seq_member.txt > seq_member_short.txt
head -10 family_member.txt > family_member_short.txt
sqlite3 compara.db < sqlcommands-test
sqlite3 compara.db 'select seq_member_id,stable_id from seq_member'
rm compara.db
sqlite3 compara.db < sqlcommands