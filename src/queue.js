"use strict";

const spawn = require('threads').spawn;

class ThreadQueue {
  constructor(task) {
    this.task = task;
    this.queue = [];
    this.running = false;
    this.createThread();
  }

  createThread() {
    this.thread = spawn(function() {});
    this.thread.run(this.task)
      .on('message', this.onMessage.bind(this))
      .on('error', this.onError.bind(this));
  }

  destroyThread() {
    this.thread.kill();
  }

  onMessage(msg) {
    if (this.timer) clearTimeout(this.timer);
    this.queue.shift().resolve(msg);
    this.next();
  }

  onError(err) {
    this.queue.shift().reject(err);
    this.destroyThread();
    this.createThread();
    this.next();
  }

  push(input, options) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        input: input,
        options: options || {},
        resolve: resolve,
        reject: reject
      });
      if (!this.running) this.next();
    });
  }

  next() {
    this.running = this.queue.length > 0;
    if (!this.running) return;

    let current = this.queue[0];
    this.thread.send(current.input);
    if (current.options.timeout)
      this.timer = setTimeout(() =>
        this.onError('Timeout'), current.options.timeout);
  }
}

module.exports = ThreadQueue;
