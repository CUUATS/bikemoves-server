const assert = require('assert');
const Combinatorics = require('js-combinatorics');

class Distribution {

  constructor(data) {
    this.totalCount = data.map((item) => item.count)
      .reduce((sum, count) => sum + count, 0);
    this.min = (data.length) ? data[0].value : null;
    this.max = (data.length) ? data[data.length - 1].value: null;

    let agg = 0;
    this.data = data.map((item) => {
      agg += item.count;
      return {
        value: item.value,
        count: item.count,
        percentile: agg / this.totalCount
      };
    });
  }

  format(stops) {
    let i = 0;
    stops = stops.concat([this.max + 1]);

    let stopInfo = stops.map((stop, s) => {
      let count = 0;
      while(i < this.data.length && this.data[i].value < stop) {
        count += this.data[i].count;
        i++;
      }
      return {
        lower: (s === 0) ? this.min : stops[s - 1],
        upper: stop,
        count: count
      };
    }).filter((info) => info.count > 0);

    return {
      min: this.min,
      max: this.max,
      stops: stopInfo
    };
  }

  quantiles(options) {
    let i = 0;
    return options.profile.map((pct) => {
      while (i < this.data.length && this.data[i].percentile < pct) i++;
      if (i === 0 || this.data[i].percentile - pct <
        pct - this.data[i - 1].percentile) return this.data[i].value;
      return this.data[i - 1].value;
    });
  }

  adjust(quantiles, options) {
    if (options.equal) {
      let size = 0;
      for (let i = 1; i < quantiles.length; i++)
        size += quantiles[i] - quantiles[i - 1];
      size = Math.round(size / (quantiles.length - 1));

      let start = (quantiles[0] > this.min) ? quantiles[0] : quantiles[0] + 1;
      while (size > 1 && start + size * (quantiles.length - 1) >= this.max)
        size--;

      return quantiles.map((q, i) => start + size * i);
    } else if (options.center !== null) {
      let center = options.center;
      let diff = quantiles.map((q) => Math.abs(center - q));
      let mirror = [];
      for (let i = 0; i < Math.floor(quantiles.length / 2); i++)
        mirror.push(Math.floor((diff[i] + diff[diff.length - i - 1]) / 2));

      let stops = [];
      for (let i = 0; i < mirror.length; i++) stops.push(center - mirror[i]);
      if (quantiles.length % 2 === 1) stops.push(center);
      for (let i = mirror.length - 1; i >= 0; i--)
        stops.push(center + mirror[i]);

      return stops;
    }

    return quantiles;
  }

  fit(n, options) {
    if (this.data.length === 0) return {
      min: null,
      max: null,
      stops: []
    };

    options = Object.assign({
      equal: true,
      center: null,
      profile: Array(n - 1).fill(null).map((v, i) => (1 + i) / n)
    }, options);

    assert.equal(n - 1, options.profile.length,
      'Profile length must be equal to n - 1');

    let quantiles = this.quantiles(options);
    let stops = this.adjust(quantiles, options);
    return this.format(stops);
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
    {value: 12, count: 4.5}
  ]);

  assert.deepEqual(dist.fit(5), {
    min: 1,
    max: 12,
    stops:
     [ { lower: 1, upper: 2, count: 13.2 },
       { lower: 2, upper: 4, count: 6.4 },
       { lower: 4, upper: 6, count: 0 },
       { lower: 6, upper: 8, count: 19.6 },
       { lower: 8, upper: 13, count: 12.4 } ] });

  assert.deepEqual(dist.fit(5, {center: 6, equal: false}), {
    min: 1,
    max: 12,
    stops:
     [ { lower: 1, upper: 3, count: 14.6 },
       { lower: 3, upper: 5, count: 5 },
       { lower: 5, upper: 7, count: 8.1 },
       { lower: 7, upper: 9, count: 19.4 },
       { lower: 9, upper: 13, count: 4.5 } ] });

}
