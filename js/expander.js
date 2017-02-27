"use strict";

const stream = require('stream');
const util = require('util');

const Transform = stream.Transform;
const PassThrough = stream.PassThrough;

function Expander() {
  // allow use without new
  if (!(this instanceof Expander)) {
    return new Expander();
  }
  // init Transform
  Transform.call(this, {objectMode: true});
}

util.inherits(Expander, Transform);

Expander.prototype._transform = function (group, enc, cb) {
  let self = this;
  group.forEach( entry => self.push(entry) );
  cb();
};

exports.Expander = Expander;