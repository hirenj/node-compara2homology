"use strict";

const stream = require('stream');
const util = require('util');

const Transform = stream.Transform;
const PassThrough = stream.PassThrough;

const onlyUnique = function(value, index, self) {
    return self.indexOf(value) === index;
};

function FamilyGroup() {
  // allow use without new
  if (!(this instanceof FamilyGroup)) {
    return new FamilyGroup();
  }
  this.entries = [];
  // init Transform
  Transform.call(this, {objectMode: true});
}
util.inherits(FamilyGroup, Transform);

FamilyGroup.prototype._transform = function (chunk, enc, cb) {
  if (this.last_family && chunk.family_id !== this.last_family) {
    if (Array.isArray(chunk)) {
      this.push(["fam"+this.last_family+"ids", chunk.filter(onlyUnique)]);
    }
    if (this.entries.length > 1) {
      this.push(["fam"+this.last_family, [].concat(this.entries)]);
    }
    this.entries.length = 0;
  }
  this.entries.push({ 'uniprot' : chunk.stable_id, 'cigar' : chunk.cigar_line, 'taxonomy' : chunk.taxon_id });
  this.last_family = chunk.family_id;
  cb();
};

FamilyGroup.prototype._flush = function (cb) {
  if (this.entries.length > 1) {
    this.push(["fam"+this.last_family, [].concat(this.entries)]);
  }
  this.entries.length = 0;
  cb();
};

function HomologyGroup() {
  if (!(this instanceof HomologyGroup)) {
    return new HomologyGroup();
  }
  Transform.call(this, {objectMode: true});
}

util.inherits(HomologyGroup, Transform);

HomologyGroup.prototype._transform = function (family_entry, enc, cb) {
  let family = family_entry[1];
  let self = this;
  let uniprots = family.map(entry => entry.uniprot);
  let taxonomies = family.map(entry => entry.taxonomy);
  let family_id = family_entry[0];
  if (family_id.indexOf('ids') > 0) {
    uniprots.length = 0;
  }
  let homology_data = {'homology' : uniprots, 'taxonomy' : taxonomies, 'family' : family_id };
  uniprots.forEach(function(uniprot) {
    self.push([uniprot, homology_data]);
  });
  cb();
};

function DoGroups() {
  if (!(this instanceof DoGroups)) {
    return new DoGroups();
  }
  this.last_id = null;
  this.group = [];
  Transform.call(this, {objectMode: true});
}

util.inherits(DoGroups, Transform);

DoGroups.prototype._transform = function (row, enc, cb) {
  if (row.family_id !== this.last_id) {
    if (this.group.length > 0) {
      this.push(this.group);
    }
    this.last_id = row.family_id;
    this.group = [];
  }
  this.group.push(row);
  cb();
};

DoGroups.prototype._flush = function(cb) {
  this.push(this.group);
  cb();
};

function GroupMaker() {
  if (!(this instanceof GroupMaker)) {
    return new GroupMaker();
  }
  this.id_maps = {};
  this.taxon_maps = {};

  Transform.call(this, {objectMode: true});
}

util.inherits(GroupMaker, Transform);

GroupMaker.prototype.merge_lists = function(a,b) {
  let id_maps = this.id_maps;
  if ( a === b ) {
    return;
  }
  id_maps[b].forEach( id => {
    if (id_maps[a].indexOf(id) < 0) {
      id_maps[a].push(id);
    }
  });
  id_maps[b].relationships.forEach( relation => {
    id_maps[a].relationships.push(relation);
  });
  id_maps[a].forEach( id => id_maps[id] = id_maps[a] );
};

GroupMaker.prototype.merge_ids = function(group) {
  let self = this;

  let id_maps = this.id_maps;
  let taxon_maps = this.taxon_maps;

  let ids = group.map( obj => obj.stable_id );

  group.forEach( obj => {
    taxon_maps[obj.stable_id] = parseInt(obj.taxon_id);
  });

  let taxon_ids = group.map( obj => obj.taxon_id ).filter(onlyUnique);

  // We do not want to include paralogues in our dataset
  // for the orthologue mappings
  if (taxon_ids.length < 2) {
    return;
  }

  let relationship_string = ids.sort().join('+');

  ids.forEach( (id) => {
    if ( ! id_maps[id] ) {
      id_maps[id] = [];
      id_maps[id].relationships = [];
    }
    ids.forEach( (a_id) => {
      if (id_maps[id].indexOf(a_id) < 0) {
        id_maps[id].push(a_id);
        if (id_maps[id].relationships.indexOf(relationship_string) < 0) {
          id_maps[id].relationships.push(relationship_string);
        }
        if (id_maps[a_id]) {
          self.merge_lists(a_id,id);
        }
      }
    });
  });
};

GroupMaker.prototype._transform = function (group, enc, cb) {
  if (group.length > 1) {
    this.merge_ids(group);
  }
  cb();
};

GroupMaker.prototype._flush = function (cb) {
  let self = this;
  let family_id = 1;
  Object.keys(self.id_maps).forEach(function(id) {
    let ids = self.id_maps[id];
    if (ids.length < 2) {
      return;
    }
    family_id++;
    let objects = ids.map( (id) => { return { stable_id: id, taxon_id: self.taxon_maps[id], family_id: family_id }  });
    if (objects.length > 1) {
      objects.push( ids.relationships );
      self.push(objects);
    }
    ids.length = 0;
  });
  cb();
};

exports.DoGroups = DoGroups;
exports.HomologyGroup = HomologyGroup;
exports.FamilyGroup = FamilyGroup;
exports.GroupMaker = GroupMaker;
