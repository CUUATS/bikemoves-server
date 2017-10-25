class Explore {
  constructor() {
    this.state = {
      chartView: 'users',
      mapView: 'users'
    };
    this.charts = {};
    this.data = {};
    this.continuousColors = [
      '#bd0026',
      '#f03b20',
      '#fd8d3c',
      '#fecc5c',
      '#ffffb2'
    ];
    this.divergingColors = [
      '#d7191c',
      '#fdae61',
      '#ffffbf',
      '#abd9e9',
      '#2c7bb6'
    ];
    this.edgeLayer = 'explore-edge';
    this.pathLayer = 'bikemoves-bike-path';
    this.pathShadowLayer = 'bikemoves-bike-path-shadow';
    this.rackLayer = 'bikemoves-bike-rack';
    this.scrolling = false;
    this.initCharts();
    this.initMap();
    this.initScroll();
  }

  initScroll() {
    let scrollTimer;
    window.addEventListener('scroll', (e) => {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(this.onScroll.bind(this), 200);
    });
    this.onScroll();
  }

  onScroll() {
    this.setActiveNavItem(this.getCurrentArticleIdx());
  }

  getCurrentArticleIdx() {
    let absOffset = [].slice.call(document.querySelectorAll('article'))
      .map((el) => Math.abs(el.getBoundingClientRect().top));

    return absOffset.indexOf(Math.min.apply(null, absOffset));
  }

  setActiveNavItem(idx) {
    document.querySelectorAll('header a').forEach((el, i) => {
      el.className = (idx === i) ? 'active' : 'inactive';
    });
  }

  initMap() {
    let getStats = this.getJSON(this.absoluteURL('/statistics.json'))
        .then((statistics) => this.data.statistics = statistics);

    this.map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/dark-v9',
        center: [-88.227203, 40.109403],
        zoom: 13,
        minZoom: 12,
        maxZoom: 17
    });

    let mapLoad = new Promise((resolve, reject) => {
      this.map.on('load', resolve);
    });

    Promise.all([getStats, mapLoad]).then(() => {
      this.addMapLayers();
      this.initMapEvents();
    });

    this.initMapControls();
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

  chartTableHTML(options) {
    let html = `<table class="aria-table">`;
    if (options.title) html += `<caption>${options.title}</caption>`;
    html += `<thead><tr><th>${options.xLabel}</th>` +
      `<th>${options.yLabel}</th></tr></thead><tbody>`;

    let series, labels;
    if (options.series.length === 1) {
      series = options.series[0];
      labels = (new Array(series.length)).fill(0).map((v, i) => i + 1);
    } else {
      series = options.series;
      labels = options.labels;
    }

    for (let i = 0; i < labels.length; i++) {
      html += `<tr><td>${labels[i]}</td>` +
        `<td>${Math.round(series[i])}</td></tr>`;
    }

    html += '</tbody></table>';
    return html;
  }

  drawChart(options, chartOptions) {
    options = Object.assign({
      headingLevel: 2
    }, options);
    let chart = this.charts[options.id];

    if (chart) {
      chart.update({
        labels: options.labels,
        series: options.series
      });
      let container = document.querySelector(`#chart-${options.id}`);
      if (options.title) container.querySelector(`.title`).innerHTML =
        options.title;
      if (options.xLabel) container.querySelector(`.label-x`).innerHTML =
        options.xLabel;
      if (options.yLabel) container.querySelector(`.label-y .label`).innerHTML =
        options.yLabel;
      container.querySelector('.aria-table').innerHTML =
        this.chartTableHTML(options);
    } else {
      let container = document.querySelector(`#chart-${options.id}`);
      container.innerHTML = `<h${options.headingLevel} class="title">` +
        `${options.title}</h${options.headingLevel}>` +
        `<div class="chart ${options.cssClass}" aria-hidden="true"></div>` +
        `<div class="label-x">${options.xLabel}</div>` +
        `<div class="label-y"><span class="label">` +
        `${options.yLabel}</span></div>` + this.chartTableHTML(options);

      chart = new Chartist.Bar(container.querySelector('.chart'), {
        labels: options.labels,
        series: options.series
      }, chartOptions || {});

      this.charts[options.id] = chart;
    }

    return chart;
  }

  redrawChart(id) {
    let chart = this.charts[id];
    if (chart) chart.update();
  }

  drawStatChart(chartName) {
    let table = this.data.demographics[chartName],
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

    let chart = this.drawChart({
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

  initMapControls() {
    let toggle = document.getElementById('toggle-map-controls');
    toggle.addEventListener('click', (e) => this.toggleMapConrols(toggle));
    if (document.body.clientWidth >= 768) this.toggleMapConrols(toggle);
    this.initMapViewSelect();
  }

  toggleMapConrols(button) {
    let active = button.className !== 'active';
    button.className = (active) ? 'active' : 'inactive';
    document.getElementById('map-controls').style.display =
      (active) ? 'block' : 'none';
    if (active) this.redrawChart('edge-color');
  }

  initMapViewSelect() {
    // Apply styleSelect.
    styleSelect('#select-map-view');

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

  getMapViewPaintProperties() {
    let viewName = this.state.mapView,
      defaults = {
        'line-width': {
          stops: [
            [12, 2],
            [15, 10]
          ]
        },
        'line-color': '#dddddd'
      },
      props = {};

    if (viewName === 'users') {
      props = {
        'line-color': {
          type: 'interval',
          property: 'users',
          stops: this.getStops('users', this.continuousColors)
        }
      };
    } else if (viewName === 'trips') {
      props = {
        'line-color': {
          type: 'interval',
          property: 'trips',
          stops: this.getStops('trips', this.continuousColors)
        }
      };
    } else if (viewName === 'speed') {
      props = {
        'line-color': {
          type: 'interval',
          property: 'mean_speed',
          stops: this.getStops('speed', this.continuousColors)
        }
      };
    } else if (viewName === 'preference') {
      props = {
        'line-color': {
          type: 'interval',
          property: 'preference',
          stops: this.getStops('preference', this.divergingColors)
        }
      };
    };

    return Object.assign(defaults, props);
  }

  addMapLayers() {
    this.map.addSource('bikemoves', {
      type: 'vector',
      url: 'https://tileserver.bikemoves.me/tiles/bikemoves.json'
    });

    this.map.addSource('explore', {
      type: 'vector',
      tilejson: '2.2.0',
      name: 'bikemoves-explore',
      description: 'Map data for the BikeMoves Explore web app.',
      version: '1.0.0',
      attribution: '<a href="https://ccrpc.org/">&copy; CCRPC</a>',
      scheme: 'xyz',
      minzoom: 12,
      maxzoom: 15,
      tiles: [
         this.absoluteURL('/explore/{z}/{x}/{y}.mvt')
      ]
    });

    this.map.addLayer({
      id: this.edgeLayer,
      type: 'line',
      source: 'explore',
      'source-layer': 'edge',
      filter: this.getMapLayerFilter(),
      paint: this.getMapViewPaintProperties(),
      layout: {
        'line-cap': 'round'
      }
    }, 'road-label-small');

    this.map.addLayer({
      id: this.pathLayer,
      type: 'line',
      source: 'bikemoves',
      'source-layer': 'bike_path',
      paint: {
        'line-color': '#ffffff',
        'line-dasharray': [2, 2],
        'line-width': {
          stops: [
            [12, 0.5],
            [15, 2.5]
          ]
        }
      }
    }, 'road-label-small');

    this.map.addLayer({
      id: this.pathShadowLayer,
      type: 'line',
      source: 'bikemoves',
      'source-layer': 'bike_path',
      paint: {
        'line-color': '#000000',
        'line-dasharray': [0, 2, 2],
        'line-width': {
          stops: [
            [12, 0.5],
            [15, 2.5]
          ]
        }
      }
    }, 'road-label-small');

    this.map.addLayer({
      id: this.rackLayer,
      type: 'circle',
      source: 'bikemoves',
      'source-layer': 'bike_rack',
      paint: {
        'circle-radius': {
          base: 1,
          stops: [
            [13, 2],
            [20, 6]
          ]
        },
        'circle-color': '#ffffff',
        'circle-stroke-color': '#000000',
        'circle-stroke-width': {
          stops: [
            [12, 0.25],
            [15, 1.5]
          ]
        }
      }
    }, 'road-label-small');

    this.initLayerToggle('legend-item-bike-rack', [this.rackLayer]);
    this.initLayerToggle('legend-item-bike-path',
      [this.pathLayer, this.pathShadowLayer]);

    this.drawLegend();
  }

  initLayerToggle(id, layerNames) {
    document.getElementById(id).addEventListener('change', (e) =>
      layerNames.forEach((layerName) =>
        this.map.setLayoutProperty(layerName, 'visibility',
          (e.target.checked) ? 'visible' : 'none')));
  }

  initMapEvents() {
    this.map.on('mouseenter', this.edgeLayer, () =>
      this.map.getCanvas().style.cursor = 'pointer');

    this.map.on('mouseleave', this.edgeLayer, () =>
      this.map.getCanvas().style.cursor = '');

    this.map.on('click', this.edgeLayer, (e) => {
      let feature = e.features[0];
      if (!feature) return;

      let midpoint = turf.along(feature.geometry,
        turf.lineDistance(feature.geometry) * 0.5);

      new mapboxgl.Popup()
        .setLngLat(midpoint.geometry.coordinates)
        .setHTML(this.formatFeatureProperties(feature.properties))
        .addTo(this.map);

      this.map.easeTo({
        center: midpoint.geometry.coordinates
      });
    });
  }

  formatFeatureProperties(props) {
    return `<h2>Segment Details</h2>
      <table>
        <thead><tr><th>Property</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Users</td><td>${props.users}</td></tr>
          <tr><td>Trips</td><td>${props.trips}</td></tr>
          <tr><td>Average Speed</td><td>${props.mean_speed.toFixed(1)} MPH</td></tr>
          <tr><td>Preference</td><td>${props.preference}</td></tr>
        </tbody>
      </table>`;
  }

  getMapLayerFilter() {
    if (this.state.mapView === 'preference') {
      let exclude = this.data.statistics['preference'].stops[2];

      return ['any',
        ['>=', 'preference', exclude.upper],
        ['<', 'preference', exclude.lower]
      ];
    }
    return ['>', 'users', 0];
  }

  updateMapView() {
    let props = this.getMapViewPaintProperties();
    for (let propName in props)
      this.map.setPaintProperty(this.edgeLayer, propName, props[propName]);
    this.map.setFilter(this.edgeLayer, this.getMapLayerFilter());
    this.drawLegend();
  }

  drawLegendChart(chartId, propName, title, xLabel, yLabel, values, exclude) {
    exclude = exclude || [];
    values = values.filter((v, i) => exclude.indexOf(i) === -1);
    let stats = this.data.statistics[propName],
      labels = stats.stops.map((stop) => {
        if (stop.upper === stop.lower + 1) return stop.lower.toString();
        return `${stop.lower} to ${stop.upper - 1}`;
      }).filter((v, i) => exclude.indexOf(i) === -1),
      series = stats.stops.map((stop) => stop.count)
        .filter((v, i) => exclude.indexOf(i) === -1);

    let chart = this.drawChart({
      id: chartId,
      title: title,
      cssClass: 'ct-octave',
      headingLevel: 3,
      xLabel: xLabel,
      yLabel: yLabel,
      labels: labels,
      series: [series]
    }, {
      axisX: {
        showGrid: false
      },
      axisY: {
        onlyInteger: true
      }
    });

    chart.off('draw');

    chart.on('draw', (data) => {
      if (data.type !== 'bar') return;
      let value = values[data.index],
        cssProp = (isNaN(value)) ? 'stroke' : 'stroke-width';

      data.element._node.style[cssProp] = value;
    });

    chart.update();
  }

  drawLegend() {
    let viewName = this.state.mapView;

    document.querySelectorAll('.view-info')
      .forEach((el) => el.style.display = 'none');
    document.querySelectorAll('.view-info.info-' + viewName)
      .forEach((el) => el.style.display = 'block');

    if (viewName === 'users') {
      this.drawLegendChart('edge-color', 'users', 'Users', 'Users',
        'Miles', this.continuousColors);
    } else if (viewName === 'trips') {
      this.drawLegendChart('edge-color', 'trips', 'Trips', 'Trips',
        'Miles', this.continuousColors);
    } else if (viewName === 'speed') {
      this.drawLegendChart('edge-color', 'speed', 'Average Speed', 'MPH',
        'Miles', this.continuousColors);
    } else if (viewName === 'preference') {
      this.drawLegendChart('edge-color', 'preference', 'Preference',
        'Net Trips', 'Miles', this.divergingColors, [2]);
    }
  }
}

let explore = new Explore();
