const Chartist = require('chartist');

class Charts {
  constructor() {
    this.charts = {};
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

  chartTableHTML(options) {
    let html = `<table class="aria-table">`;
    if (options.title) html += `<caption>${options.title}</caption>`;
    html += `<thead><tr><th>${options.xLabel}</th>` +
      `<th>${options.yLabel}</th></tr></thead><tbody>`;

    let series, labels;
    if (options.series.length === 1) {
      series = options.series[0];
      labels = [];
      for (let i = 0; i < series.length; i++) labels.push(i + 1);
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
}

module.exports = Charts;
