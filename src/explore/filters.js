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
  'date': 'date'
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

    let varType = VARIABLES[filter.variable];
    if (OPERATORS.indexOf(filter.operator) === -1) return null;
    if (varType === undefined) return null;

    if (Array.isArray(varType)) {
      if (filter.operator !== '=') return null;
      filter.value = varType.indexOf(filter.value);
      if (filter.value === -1) return null;
    } else if (varType === 'int' || varType === 'float') {
      filter.value = (varType === 'int') ?
        parseInt(filter.value) : parseFloat(filter.value);
      if (isNaN(filter.value)) return null;
    } else if (varType === 'duration' || varType === 'time') {
      let parts = filter.value.match(/^(\d{1,2}):(\d{2})$/);
      let hour = parseInt(parts[1]);
      let minute = parseInt(parts[2]);
      if (isNaN(hour) || isNaN(minute)) return null;
      if (hour < 0 || hour > 23) return null;
      if (minute < 0 || minute > 59) return null;
    } else if (varType === 'date') {
      let parts = filter.value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      let year = parseInt(parts[1]);
      let month = parseInt(parts[2]);
      let day = parseInt(parts[3]);
      if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
      if (year < 2000 || year > 3000) return null;
      if (month < 1 || month > 12) return null;
      if (day < 1 || day > 31) return null;
    }

    return filter;
  }

  objects() {
    return this._filters;
  }

  querystring() {
    let text = this._filters
      .map((f) => [f.variable, f.operator, f.value].join(''))
      .sort();

    return (text.length) ?
      '?filters=' + encodeURIComponent(text.join(',')) : '';
  }
}

FilterParser.validate = function(text) {
  return FilterParser.prototype.parseFilter(text) !== null;
}

module.exports = FilterParser;
