const express = require('express'),
  path = require('path');

function serveLib(app, fsPath, servePath) {
  let absPath = path.resolve(path.join('node_modules/', fsPath));
  app.use(path.join('/lib/', servePath), (req, res) => res.sendFile(absPath));
}

module.exports.serveLib = serveLib;
