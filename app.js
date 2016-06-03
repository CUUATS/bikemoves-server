const express = require('express'),
  ProtoBuf = require('protobufjs'),
  bodyParser = require('body-parser'),
  db = require('db.js');

var app = express(),
  messages = ProtoBuf.loadJsonFile('messages.json').build();

// Set up middleware.
app.enable('trust proxy');
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
app.use(bodyParser.json());

// Helper functions
var extractMessage = function(req, Message) {
    if (!req.body) throw 'Missing post data';
    try {
      return Message.decode(req.body);
    } catch(e) {
      console.error(e.stack);
      throw 'Malformed request';
    }
  };

app.post('/:version/user', function(req, res) {
  var userMsg = extractMessage(req, messages.bikemoves.User);
  db.User.upsert(userMsg).then(function(createdUser) {
    res.send(((createdUser) ? 'Created' : 'Updated') + ' user');
  }).catch(function(e) {
    console.error(e.stack);
    res.status(500).send('Error saving user');
  });
});

app.post('/:version/trip', function(req, res) {
  var tripMsg = extractMessage(req, messages.bikemoves.Trip);
  db.User.findOrCreate({
    where: {deviceUUID: tripMsg.deviceUuid}
  }).spread(function(user, created) {
    return db.Trip.create(db.Trip.fromMessage(tripMsg, user.id));
  }).then(function(trip) {
    return db.Point.bulkCreate(db.Point.fromTripMessage(tripMsg, trip.id));
  }).then(function() {
    res.send('Saved trip');
  }).catch(function(e) {
    console.error(e.stack);
    res.status(500).send('Error saving trip');
  });
});

app.listen(8888);
