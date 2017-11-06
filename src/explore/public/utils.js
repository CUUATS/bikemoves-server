function absoluteURL(url) {
  return location.protocol + '//' + location.hostname + (
    location.port ? ':' + location.port : '') + url;
}

function getJSON(url) {
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

function pad(n, w) {
  let d = n.toString();
  return (d.length >= w) ? d : new Array(w - d.length + 1).join('0') + d;
}

function formatDuration(duration) {
  let hours = pad(duration.hours(), 2),
    minutes = pad(duration.minutes(), 2),
    seconds = pad(duration.seconds(), 2);

  return [hours, minutes, seconds].join(':');
}

module.exports.absoluteURL = absoluteURL;
module.exports.getJSON = getJSON;
module.exports.formatDuration = formatDuration;
