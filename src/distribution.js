const Combinatorics = require('js-combinatorics');

class Distribution {

  constructor(data) {
    this.totalCount = data.map((item) => item.count)
      .reduce((sum, count) => sum + count, 0);
    this.min = data[0].value;
    this.max = data[data.length - 1].value;

    let agg = 0;
    this.data = data.map((item) => {
      agg += item.count;
      return {
        value: item.value,
        percentile: agg / this.totalCount
      };
    });
  }

  getStops(size, start) {
    let stops = [(this.zeroBased) ? 0 : this.min, start];
    for (let i = 1; i < this.n - 1; i++) stops.push(start + i * size);

    let i = 0,
      grandTotal = 0,
      cumulativeTotal = 0;

    return stops.slice(1).concat([Infinity]).map((upper) => {
      let stopTotal = 0;
      while (i < this.data.length && this.data[i].value < upper) {
        stopTotal += this.data[i].count;
        i++;
      }
      grandTotal += stopTotal;
      return stopTotal;
    }).map((stopTotal, stopIdx) => {
      cumulativeTotal += stopTotal;

      return {
        lower: stops[stopIdx],
        upper: (stopIdx === this.n - 1) ? this.max : stops[stopIdx + 1],
        count: stopTotal,
        percentile: cumulativeTotal / grandTotal
      };
    });
  }

  scoreStops(stops, profile) {
    return 1 - stops
      .map((stop, i) => Math.abs(stop.percentile - profile[i]))
      .reduce((sum, score) => sum + score, 0);
  }

  checkStops(size, start) {
    let stops = this.getStops(size, start),
      score = this.scoreStops(stops);

    if (score > this.best.score) {
      this.best.score = score;
      this.best.stops = stops;
    }
  }

  validateStops(stops, options) {
    for (let i = 1; i < stops.length; i++) {
      let current = stops[i],
        prev = stops[i - 1],
        next = stops[i + 1],
        opposite = stops[stops.length - i];

      if (options.equal && next !== undefined && prev !== undefined
          && current - prev !== next - current) return false;

      if (options.center !== null
          && options.center - current !== opposite - options.center)
        return false;
    }
    return true;
  }

  fit(n, options) {
    options = Object.assign({
      equal: true,
      center: null,
      profile: Array(n).map((v, i) => i / n)
    }, options);

    let values = this.data.map((item) => item.value);
    let best = {
      score: -1,
      stops: []
    };

    Combinatorics.combination(values, n).forEach((stops) => {
      console.log(stops, this.validateStops(stops, options));
      // if (!this.validateStops(stops, options)) return;

      // let score = this.scoreStops(stops, profile);
      // if (score > best.score) {
      //   best.score = score;
      //   best.stops = stops;
      // }
    });

    return {
      min: this.min,
      max: this.max,
      score: best.score,
      stops: best.stops
    };
  }
}

module.exports = Distribution;

if (require.main === module) {
  let dist = new Distribution([
    {value: 1, count: 13.2},
    {value: 2, count: 1.4},
    {value: 3, count: 5.0},
    {value: 6, count: 8.1},
    {value: 7, count: 11.5},
    {value: 8, count: 7.9},
    {value: 12, count: 4.2}
  ]);
  console.log('totalCount', dist.totalCount);
  console.log('min', dist.min);
  console.log('max', dist.max);
  console.log('data', dist.data);
  dist.fit(5);
}
