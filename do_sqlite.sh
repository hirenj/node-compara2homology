#!/bin/bash

cp sqlcommands /codebuild/output
cp sqlcommands-test /codebuild/output

cd /codebuild/output

head -10 seq_member.txt > seq_member_short.txt
head -10 family_member.txt > family_member_short.txt
sqlite3 compara.db < sqlcommands-test
sqlite3 compara.db 'select seq_member_id,stable_id from seq_member'
rm /codebuild/output; compara.db
sqlite3 compara.db < sqlcommands