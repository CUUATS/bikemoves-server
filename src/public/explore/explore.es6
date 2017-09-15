class Explore {
  constructor() {
    this.state = {
      chartView: 'users',
      mapView: 'users-speed'
    };
    this.charts = {};
    this.data = {};
    this.edgeColors = [
      '#253494',
      '#2c7fb8',
      '#41b6c4',
      '#a1dab4',
      '#ffffcc'
    ];
    this.edgeWidths = [3, 6, 9, 12, 15];

    this.initCharts();
    this.initMap();
  }

  initMap() {
    let getStats = this.getJSON(this.absoluteURL('/statistics.json'))
        .then((statistics) => this.data.statistics = statistics);

    this.map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/dark-v9',
        center: [-88.227203, 40.109403],
        zoom: 13
    });

    let mapLoad = new Promise((resolve, reject) => {
      this.map.on('load', resolve);
    });

    Promise.all([getStats, mapLoad]).then(this.addLayers.bind(this));

    this.initMapViewSelect();
  }

  initCharts() {
    this.getJSON(this.absoluteURL('/demographics.json'))
      .then((data) => {
        this.data.demographics = data;
        this.initChartViews();
      });
  }

  initChartViews() {
    let data = this.data.demographics,
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

  drawChart(options, chartOptions) {
    let container = document.querySelector(`#chart-${options.id}`);
    container.innerHTML = `<h2>${options.title}</h2>` +
      `<div class="chart ${options.cssClass}"></div>` +
      `<div class="label-x">${options.xLabel}</div>` +
      `<div class="label-y"><span class="label">${options.yLabel}</span></div>`;

    let chart = new Chartist.Bar(container.querySelector('.chart'), {
      labels: options.labels,
      series: options.series
    }, chartOptions || {});

    this.charts[options.id] = chart;
    return chart;
  }

  drawStatChart(chartName) {
    let table = this.data.demographics[chartName],
      statName = this.state.chartView,
      labels = table.map((row) => row.description),
      series = table.map((row) => row[statName]),
      yLabel = {
        users: 'Total Users',
        trips: 'Total Trips',
        distance: 'Total Miles'
      }[statName];

    if (this.charts[chartName]) {
      this.charts[chartName].update({
        labels: labels,
        series: series
      });
      document.querySelector(`#chart-${chartName} .label-y .label`)
        .innerHTML = yLabel;
    } else {
      let xLabel = {
        age: 'Age',
        gender: 'Gender',
        'cycling-experience': 'Cycling Experience'
      }[chartName];

      this.drawChart({
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
    }
  }

  drawStatHistogram(chartName, xName, yName) {
    let table = this.data.demographics[chartName],
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

    let chart = this.drawChart({
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

  initMapViewSelect() {
    // Apply styleSelect.
    window.returnExports('#select-map-view');

    let select = document.getElementById('select-map-view');
    select.addEventListener('change', (e) => {
      let viewName = select.options[select.selectedIndex].value;
      if (this.state.mapView === viewName) return;
      this.state.mapView = viewName;
      this.updateMapView();
    });
  }

  getStops(propName, values) {
    return this.data.statistics[propName].stops
      .map((stop, i) => [stop.lower, values[i]]);
  }

  getMapViewPaintProperties(viewName) {
    if (viewName === 'users-speed') return {
      'line-color': {
        type: 'interval',
        property: 'mean_speed',
        stops: this.getStops('speed', this.edgeColors)
      },
      'line-width': {
        type: 'interval',
        property: 'users',
        stops: this.getStops('users', this.edgeWidths)
      }
    };

    if (viewName === 'trips-speed') return {
      'line-color': {
        type: 'interval',
        property: 'mean_speed',
        stops: this.getStops('speed', this.edgeColors)
      },
      'line-width': {
        type: 'interval',
        property: 'trips',
        stops: this.getStops('trips', this.edgeWidths)
      }
    };
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
      paint: this.getMapViewPaintProperties(this.state.mapView),
      layout: {
        'line-cap': 'round'
      }
    }, 'road-label-small');
  }

  updateMapView() {
    let props = this.getMapViewPaintProperties(this.state.mapView);
    for (let propName in props)
      this.map.setPaintProperty('bikemoves-edge', propName, props[propName]);
  }

  drawLegend() {
    let props = this.getMapViewPaintProperties(this.state.mapView);

  }
}



let explore = new Explore();
