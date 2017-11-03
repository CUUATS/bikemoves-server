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

module.exports.absoluteURL = absoluteURL;
module.exports.getJSON = getJSON;
