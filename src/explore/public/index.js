require('../../../node_modules/styleselect/css/styleselect.css');
require('../../../node_modules/chartist/dist/chartist.min.css');
require('../../../node_modules/mapbox-gl/dist/mapbox-gl.css');
require('./explore.css');

require('./assets/app-store.png');
require('./assets/download-01.jpg');
require('./assets/download-02.jpg');
require('./assets/download-03.jpg');

const Demographics = require('./demographics.js');
const Map = require('./map.js');

(document.querySelector('article').id === 'demographics') ?
  new Demographics(bikemoves.data) : new Map(bikemoves.data);
