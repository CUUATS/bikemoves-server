class Examine {
  addLayers() {


    ['points', 'legs'].forEach((name) => {
      let layerName = `bikemoves-${name}`;
      this.map.on('click', layerName, (e) => this.onLayerClick(e));
      this.map.on('mouseenter', layerName, () =>
        this.map.getCanvas().style.cursor = 'pointer');
      this.map.on('mouseleave', layerName, () =>
        this.map.getCanvas().style.cursor = '');
    });
  }

  onLayerClick(e) {
    if (!e.features.length) return;

    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(this.popupContent(e.features[0]))
      .addTo(this.map);
  }

  popupContent(feature) {
    let props = feature.properties,
      html = '<table class="popup-table"><thead><tr><th>Column</th>' +
        '<th>Value</th></tr></thead><tbody>';
    for (var key in props) if (props.hasOwnProperty(key))
      html += '<tr><td>' + key + '</td><td>' + props[key] + '</td></tr>';

    html += '</tbody></table>'
    return html;
  }

  populateMap(tripId, bbox) {
    this.layerNames.forEach((name) =>
      this.map.getSource(name).setData(`/api/${name}/${tripId}.geojson`));
    this.map.fitBounds(bbox, {
      padding: 20
    });
  }






let examine = new Examine();
