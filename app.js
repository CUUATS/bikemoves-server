const express = require('express'),
  ProtoBuf = require('protobufjs'),
  bodyParser = require('body-parser'),
  lzString = require('lz-string'),
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

// Legacy API conversions
const AGE = {
    'Under 15': messages.bikemoves.User.Age.AGE_UNDER_15,
    '15 to 19': messages.bikemoves.User.Age.AGE_15_TO_19,
    '20 to 24': messages.bikemoves.User.Age.AGE_20_TO_24,
    '25 to 34': messages.bikemoves.User.Age.AGE_25_TO_34,
    '35 to 44': messages.bikemoves.User.Age.AGE_35_TO_44,
    '45 to 54': messages.bikemoves.User.Age.AGE_45_TO_54,
    '55 to 64': messages.bikemoves.User.Age.AGE_55_TO_64,
    '65 to 74': messages.bikemoves.User.Age.AGE_65_TO_74,
    '75 and Older': messages.bikemoves.User.Age.AGE_75_AND_OLDER
  },
  EXPERIENCE_LEVEL = {
    'Beginner': messages.bikemoves.User.ExperienceLevel.BEGINNER,
    'Intermediate': messages.bikemoves.User.ExperienceLevel.INTERMEDIATE,
    'Advanced': messages.bikemoves.User.ExperienceLevel.ADVANCED
  },
  GENDER = {
    'Male': messages.bikemoves.User.Gender.MALE,
    'Female': messages.bikemoves.User.Gender.FEMALE,
    'Other': messages.bikemoves.User.Gender.OTHER
  },
  LOCATION_TYPE = {
    'Home': messages.bikemoves.Trip.LocationType.HOME,
    'Work': messages.bikemoves.Trip.LocationType.WORK,
    'K-12 School': messages.bikemoves.Trip.LocationType.K12_SCHOOL,
    'University': messages.bikemoves.Trip.LocationType.UNIVERSITY
    'Shopping': messages.bikemoves.Trip.LocationType.SHOPPING,
    'Other':  messages.bikemoves.Trip.LocationType.OTHER
  };

var messageFromData = function(body, Message) {
  if (!body.data) throw 'Data key is empty';
  var data = JSON.parse(lzString.decompressFromBase64(body.data));
  if (!data.deviceUUID) throw 'Missing device UUID';

  data.deviceUuid = data.deviceUUID;
  delete data.deviceUUID;

  if ('age' in data) data.age = AGE[data.age] || 0;
  if ('cyclingExperience' in data) data.cyclingExperience =
    EXPERIENCE_LEVEL[data.cyclingExperience] || 0;
  if ('gender' in data) data.gender = GENDER[data.gender] || 0;
  if ('origin' in data) data.origin = LOCATION_TYPE[data.origin] || 0;
  if ('destination' in data) data.destination =
    LOCATION_TYPE[data.destination] || 0;
};

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
  var userMsg = (request.params.version == 'v0.1') ?
    messageFromData(req.body, messages.bikemoves.User) :
    extractMessage(req, messages.bikemoves.User);
  db.User.upsert(userMsg).then(function(createdUser) {
    res.send(((createdUser) ? 'Created' : 'Updated') + ' user');
  }).catch(function(e) {
    console.error(e.stack);
    res.status(500).send('Error saving user');
  });
});

app.post('/:version/trip', function(req, res) {
  var tripMsg = (request.params.version == 'v0.1') ?
    messageFromData(req.body, messages.bikemoves.Trip) :
    extractMessage(req, messages.bikemoves.Trip);
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
