const Charts = require('./charts.js');
const utils = require('./utils.js');

class Demographics {
  constructor() {
    this.charts = new Charts();
    this.state = {
      chartView: 'users'
    };
    this.demographics = [];
    utils.getJSON('/api/v1/demographics').then((res) => {
      this.demographics = res.demographics;
      this.init();
    });
  }

  init() {
    let viewButtons = document.querySelectorAll('#stats li');
    viewButtons.forEach((button) => {
      let link = button.querySelector('a'),
        value = button.querySelector('.value'),
        statName = button.className;

      value.innerHTML = this.formatNumber(
        this.getStatTotal(this.demographics, statName), 0);
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.state.chartView = statName;
        this.showStatCharts();
      });
    });
    this.showStatCharts();
    this.drawStatHistogram('trip-count', 'trips', 'users');
  }

  showStatCharts() {
    let statName = this.state.chartView;
    document.querySelectorAll('#stats li a').forEach((link) => {
      link.className = (link.parentNode.className === statName) ? 'active' : '';
    });
    ['age', 'gender', 'cycling-experience'].forEach(
      this.drawStatChart.bind(this));
  }

  drawStatChart(chartName) {
    let table = this.demographics[chartName],
      statName = this.state.chartView,
      labels = table.map((row) => row.description),
      series = table.map((row) => row[statName]),
      xLabel = {
        age: 'Age',
        gender: 'Gender',
        'cycling-experience': 'Cycling Experience'
      }[chartName],
      yLabel = {
        users: 'Total Users',
        trips: 'Total Trips',
        distance: 'Total Miles'
      }[statName];

    let chart = this.charts.drawChart({
      id: chartName,
      title: xLabel,
      cssClass: 'ct-octave',
      xLabel: xLabel,
      yLabel: yLabel,
      labels: labels,
      series: series
    }, {
      axisY: {
        onlyInteger: true
      },
      chartPadding: {
        left: 25
      },
      distributeSeries: true
    });

    chart.off('draw');

    chart.on('draw', (data) => {
      if (data.type !== 'bar') return;
      let node = data.element._node;
      node.setAttribute('class',
        node.getAttribute('class') +
        ' ct-bar-' + labels[data.seriesIndex].toLowerCase().replace(/ /g, '-'));
    });
  }

  drawStatHistogram(chartName, xName, yName) {
    let table = this.demographics[chartName],
      x = table.map((row) => row[xName]),
      y = table.map((row) => row[yName]),
      xMin = Math.min.apply(null, x),
      xMax = Math.max.apply(null, x),
      numBars = xMax - xMin + 1,
      labelFreq = Math.ceil(numBars / 10 / 5) * 5,
      values = [],
      labels = [];

    for (let i = xMin; i <= xMax; i++) {
      labels.push(((i - xMin + 1) % labelFreq === 0) ? i.toString() : '');
      let idx = x.indexOf(i);
      values.push((idx === -1) ? 0 : y[idx]);
    }

    let chart = this.charts.drawChart({
      id: chartName,
      title: 'Trips per User',
      cssClass: 'ct-octave',
      xLabel: 'Trips',
      yLabel: 'Users',
      labels: labels,
      series: [values]
    }, {
      axisX: {
        showGrid: false
      },
      axisY: {
        onlyInteger: true
      },
      chartPadding: {
        left: 25
      }
    });

    chart.on('draw', (data) => {
      if (data.type !== 'bar') return;
      data.element._node.style['stroke-width'] = (100 / numBars) + '%';
    });
  }

  getStatTotal(data, statName) {
    return data.gender.reduce((sum, row) => {
      return sum + row[statName];
    }, 0);
  }

  formatNumber(value, digits) {
    return (+value.toFixed(digits)).toLocaleString();
  }
}

module.exports = Demographics;
