function absoluteURL(url) {
  return location.protocol + '//' + location.hostname + (
    location.port ? ':' + location.port : '') + url;
}

function getJSON(url, skipCache) {
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
    if (skipCache) req.setRequestHeader('x-apicache-bypass', true);
    req.send();
  });
}

function pad(n, w) {
  let d = n.toString();
  return (d.length >= w) ? d : new Array(w - d.length + 1).join('0') + d;
}

function formatDuration(start, end) {
  let totalSec = Math.round((end - start) / 1000);

  let hours = Math.floor(totalSec / 3600);
  let minutes = Math.floor((totalSec % 3600) / 60);
  let seconds = totalSec % 60;

  return [pad(hours, 2), pad(minutes, 2), pad(seconds, 2)].join(':');
}

module.exports.absoluteURL = absoluteURL;
module.exports.getJSON = getJSON;
module.exports.formatDuration = formatDuration;
