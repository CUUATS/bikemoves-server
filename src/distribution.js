class Distribution {

  constructor(data, n, zeroBased) {
    this.data = data.slice();
    this.n = n;
    this.zeroBased = zeroBased;

    this.min = data[0].value;
    this.max = data[data.length - 1].value;
    this.best = {
      score: -1,
      stops: []
    };
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

  scoreStops(stops) {
    return 1 - stops
      .map((stop, i) => Math.abs(stop.percentile - ((i + 1) / this.n)))
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

  fit() {
    let maxSize = Math.ceil((this.max - this.min) / this.n);
    
    // TODO: Improve stop checking performance by eliminating unlikely
    // possibilities.
    for (let size = 1; size <= maxSize; size++) {
      if (this.zeroBased) {
        this.checkStops(size, size);
      } else {
        for (let start = this.min; start +
            size * (this.n - 2) < this.max; start++)
          this.checkStops(size, start);
      }
    }

    return {
      min: this.min,
      max: this.max,
      score: this.best.score,
      stops: this.best.stops
    };
  }
}

module.exports = Distribution;
