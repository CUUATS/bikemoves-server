const OPERATORS = ['>', '>=', '=', '<', '<='];
const OD_TYPES = [
  'unspecified',
  'home',
  'work',
  'k12',
  'university',
  'shopping',
  'other'
];
const VARIABLES = {
  'age': 'int',
  'distance': 'float',
  'duration': 'duration',
  'end': 'time',
  'experience': ['unspecified', 'beginner', 'intermediate', 'advanced'],
  'gender': ['unspecified', 'male', 'female', 'other'],
  'start': 'time',
  'user': 'int',
  'origin': OD_TYPES,
  'destination': OD_TYPES,
  'date': 'date',
  'trip': 'int'
};

class FilterParser {
  constructor(text) {
    if (!Array.isArray(text)) text = text.split(',');
    this._filters = text.map((f) => this.parseFilter(f))
      .filter((f) => f !== null);
  }

  parseFilter(text) {
    let parts = text.match(/^([^><=]+)([><=]{1,2})([^><=]+)$/);
    if (!parts) return null;

    let filter = {
      variable: parts[1].replace(/ /g, ''),
      operator: parts[2].replace(/ /g, ''),
      value: parts[3].replace(/ /g, '')
    };

    filter.type = VARIABLES[filter.variable];

    if (OPERATORS.indexOf(filter.operator) === -1) return null;
    if (filter.type === undefined) return null;

    if (Array.isArray(filter.type)) {
      if (filter.operator !== '=') return null;
      let idx = filter.type.indexOf(filter.value);
      if (idx === -1) return null;
      filter.index = idx;
    } else if (filter.type === 'int' || filter.type === 'float') {
      filter.value = (filter.type === 'int') ?
        parseInt(filter.value) : parseFloat(filter.value);
      if (isNaN(filter.value)) return null;
    } else if (filter.type === 'duration' || filter.type === 'time') {
      let parts = filter.value.match(/^(\d{1,2}):(\d{2})$/);
      filter.hour = parseInt(parts[1]);
      filter.minute = parseInt(parts[2]);
      if (isNaN(filter.hour) || isNaN(filter.minute)) return null;
      if (filter.hour < 0 || filter.hour > 23) return null;
      if (filter.minute < 0 || filter.minute > 59) return null;
    } else if (filter.type === 'date') {
      let parts = filter.value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      filter.year = parseInt(parts[1]);
      filter.month = parseInt(parts[2]);
      filter.day = parseInt(parts[3]);
      if (isNaN(filter.year) || isNaN(filter.month) || isNaN(filter.day))
        return null;
      if (filter.year < 2000 || filter.year > 3000) return null;
      if (filter.month < 1 || filter.month > 12) return null;
      if (filter.day < 1 || filter.day > 31) return null;
      if (isNaN(new Date(filter.value))) return null;
    }

    return filter;
  }

  objects() {
    return this._filters.filter((f) => f.variable !== 'trip');
  }

  querystring() {
    let text = this._filters
      .filter((f) => f.variable !== 'trip')
      .map((f) => [f.variable, f.operator, f.value].join(''))
      .sort();

    return (text.length) ?
      '?filters=' + encodeURIComponent(text.join(',')) : '';
  }

  tripId() {
    for (let i = 0; i < this._filters.length; i++) {
      let filter = this._filters[i];
      if (filter.variable === 'trip') return filter.value;
    }
    return null;
  }
}

FilterParser.validate = function(text) {
  return FilterParser.prototype.parseFilter(text) !== null;
}

module.exports = FilterParser;
