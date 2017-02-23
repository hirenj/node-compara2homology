"use strict";

const stream = require('stream');
const util = require('util');

const Transform = stream.Transform;
const PassThrough = stream.PassThrough;

function Aligner() {
  // allow use without new
  if (!(this instanceof Aligner)) {
    return new Aligner();
  }
  // init Transform
  Transform.call(this, {objectMode: true});
}

util.inherits(Aligner, Transform);

Aligner.prototype._transform = function (group, enc, cb) {
  let self = this;
  group.forEach( entry => self.push(entry) );
  cb();
};

exports.Aligner = Aligner;