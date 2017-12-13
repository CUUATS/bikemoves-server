"use strict";

const express = require('express'),
  bodyParser = require('body-parser'),
  protobuf = require('protobufjs'),
  db = require('./db.js'),
  SendMail = require('sendmail');

const region = process.env.BIKEMOVES_REGION;

let app = express(),
  sendmail = SendMail(),
  UserMessage,
  TripMessage,
  IncidentMessage,
  Age,
  ExperienceLevel,
  Gender,
  LocationType;

function loadMessages() {
  return protobuf.load('bikemoves.proto').then((root) => {
    UserMessage = root.lookupType('bikemoves.User');
    TripMessage = root.lookupType('bikemoves.Trip');
    IncidentMessage = root.lookupType('bikemoves.Incident');
    Age = root.lookup('bikemoves.Age');
    ExperienceLevel = root.lookup('bikemoves.ExperienceLevel');
    Gender = root.lookup('bikemoves.Gender');
    LocationType = root.lookup('bikemoves.LocationType');
  });
}

// Set up middleware.
app.enable('trust proxy');
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
app.use(bodyParser.raw());

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

var sendEmailNotification = function(msg) {
  var date = new Date(msg.time.toNumber()),
    mapUrl = 'http://maps.google.com/maps?q=' + msg.location.latitude +
      ',' + msg.location.longitude;
  sendmail({
    from: process.env.BIKEMOVES_NOTIFICATION_FROM,
    to: process.env.BIKEMOVES_NOTIFICATION_TO,
    subject: 'BikeMoves: New incident report',
    text: 'Category:\n' + msg.category + '\n\n' +
      'Comment:\n' + msg.comment + '\n\n' +
      'Location:\n' + mapUrl + '\n\n' +
      'Submitted:\n' + date.toLocaleString() + '\n\n'
  }, function(e, reply) {
    if (e) console.error(e.stack);
    if (reply) console.dir(reply);
  });
};

app.get('/:version/status', function(req, res) {
  db.Trip.count().then(function(count) {
    res.send('OK');
  }).catch(function(e) {
    console.error(e.stack);
    res.status(500).send('Error');
  });
});

app.post('/:version/user', function(req, res) {
  var userMsg = extractMessage(req, UserMessage);
  db.User.upsert(db.User.fromMessage(userMsg)).then(function(createdUser) {
    res.send(((createdUser) ? 'Created' : 'Updated') + ' user');
  }).catch(function(e) {
    console.error(e.stack);
    res.status(500).send('Error saving user');
  });
});

app.post('/:version/trip', function(req, res) {
  var tripMsg = extractMessage(req, TripMessage);
  db.User.findOrCreate({
    where: {deviceUuid: tripMsg.deviceUuid}
  }).spread(function(user, created) {
    return db.Trip.create(db.Trip.fromMessage(tripMsg, user, region));
  }).then(function(trip) {
    return db.Point.bulkCreate(db.Point.fromTripMessage(tripMsg, trip.id));
  }).then(function() {
    res.send('Saved trip');
  }).catch(function(e) {
    console.error(e.stack);
    res.status(500).send('Error saving trip');
  });
});

app.post('/:version/incident', function(req, res) {
  var incidentMsg = extractMessage(req, IncidentMessage);
  db.User.findOrCreate({
    where: {deviceUuid: incidentMsg.deviceUuid}
  }).spread(function(user, created){
    return db.Incident.create(db.Incident.fromMessage(incidentMsg, user.id));
  }).then(function(){
    sendEmailNotification(incidentMsg);
    res.send('Saved Incident');
  }).catch(function(e){
    console.error(e.stack);
    res.status(500).send('Error saving incident');
  });
});

Promise.all([loadMessages(), db.prepare()]).then(() => {
  app.listen(8888);
  console.log('API ready');
});
