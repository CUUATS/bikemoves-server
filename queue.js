"use strict";

const spawn = require('threads').spawn;

let ThreadQueue = function(task) {
  this.task = task;
  this.queue = [];
  this.running = false;
  this.createThread();
};

ThreadQueue.prototype.createThread = function() {
  this.thread = spawn(function() {});
  this.thread.run(this.task)
    .on('message', this.onMessage.bind(this))
    .on('error', this.onError.bind(this));
};

ThreadQueue.prototype.destroyThread = function() {
  this.thread.kill();
};

ThreadQueue.prototype.onMessage = function(msg) {
  if (this.timer) clearTimeout(this.timer);
  this.queue.shift().resolve(msg);
  this.next();
};

ThreadQueue.prototype.onError = function(err) {
  this.queue.shift().reject(err);
  this.destroyThread();
  this.createThread();
  this.next();
};

ThreadQueue.prototype.push = function(input, options) {
  return new Promise((resolve, reject) => {
    this.queue.push({
      input: input,
      options: options || {},
      resolve: resolve,
      reject: reject
    });
    if (!this.running) this.next();
  });
};

ThreadQueue.prototype.next = function() {
  this.running = this.queue.length > 0;
  if (!this.running) return;

  let current = this.queue[0];
  this.thread.send(current.input);
  if (current.options.timeout)
    this.timer = setTimeout(() =>
      this.onError('Timeout'), current.options.timeout);
};

module.exports = ThreadQueue;
