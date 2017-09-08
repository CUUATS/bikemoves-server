class Explore {
  constructor() {
    this.state = {
      chartView: 'users'
    };
    this.initCharts();
    // this.initMap();
  }

  initMap() {
    this.map = map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/light-v9',
        center: [-88.227203, 40.109403],
        zoom: 13
    });
    map.on('load', this.addLayers.bind(this));
  }

  initCharts() {
    this.getJSON(this.absoluteURL('/demographics.json'))
      .then((data) => {
        this.state.demographics = data;
        this.initChartViews();
      });
  }

  initChartViews() {
    let data = this.state.demographics,
      viewButtons = document.querySelectorAll('#stats li');
    viewButtons.forEach((button) => {
      let link = button.querySelector('a'),
        value = button.querySelector('.value'),
        statName = button.className;

      value.innerHTML = this.formatNumber(this.getStatTotal(data, statName), 0);
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.state.chartView = statName;
        this.showStatCharts();
      });
    });
    this.showStatCharts();
    this.drawHistogram('trip-count', 'trips', 'users');
  }

  showStatCharts() {
    let statName = this.state.chartView;
    document.querySelectorAll('#stats li a').forEach((link) => {
      link.className = (link.parentNode.className === statName) ? 'active' : '';
    });
    ['age', 'gender', 'cycling-experience'].forEach(this.drawChart.bind(this));
  }

  drawChart(chartName) {
    let container = document.querySelector(`#chart-${chartName} .chart`),
      table = this.state.demographics[chartName],
      statName = this.state.chartView;

    let chart = new Chartist.Bar(container, {
      labels: table.map((row) => row.description),
      series: table.map((row) => row[statName])
    }, {
      axisY: {
        onlyInteger: true
      },
      chartPadding: {
        left: 25
      },
      distributeSeries: true
    });

    let ylabel = {
      users: 'Total Users',
      trips: 'Total Trips',
      distance: 'Total Miles'
    }[statName];
    container.parentNode.querySelector('.label-y').innerHTML =
      `<span class="label">${ylabel}</span>`;
  }

  drawHistogram(chartName, xName, yName) {
    let container = document.querySelector(`#chart-${chartName} .chart`),
      table = this.state.demographics[chartName],
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

    let chart = new Chartist.Bar(container, {
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

  absoluteURL(url) {
    return location.protocol + '//' + location.hostname + (
      location.port ? ':' + location.port : '') + url;
  }

  getJSON(url) {
    return new Promise((resolve, reject) => {
      let req = new XMLHttpRequest();
      req.onload = () => {
        if (req.status >= 200 && req.status < 300) {
          resolve(JSON.parse(req.response));
        } else {
          reject(req.statusText);
        }
      };
      req.onerror = () => reject(req.statusText);
      req.open('GET', url, true);
      req.send();
    });
  }

  addLayers() {
    this.map.addSource('explore', {
      type: 'vector',
      tilejson: '2.2.0',
      name: 'bikemoves-explore',
      description: 'Map data for the BikeMoves Explore web app.',
      version: '1.0.0',
      attribution: '<a href="https://ccrpc.org/">&copy; CCRPC</a>',
      scheme: 'xyz',
      tiles: [
         this.absoluteURL('/explore/{z}/{x}/{y}.mvt')
      ]
    });

    this.map.addLayer({
      id: 'bikemoves-edge',
      type: 'line',
      source: 'explore',
      'source-layer': 'edge',
      paint: {
        'line-color': {
          type: 'interval',
          property: 'mean_speed',
          stops: [
            [1, '#d7191c'],
            [2, '#fdae61'],
            [3, '#ffffbf'],
            [4, '#abd9e9'],
            [5, '#2c7bb6']
          ]
        },
        'line-width': {
          type: 'interval',
          property: 'users',
          stops: [
            [2, 4],
            [4, 8],
            [6, 12],
            [8, 16]
          ]
        }
      },
      layout: {
        'line-cap': 'round'
      }
    }, 'road-label-small');
  }
}

let explore = new Explore();
