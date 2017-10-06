// Compare the alternative routes to the actual route.
const db = require('./db.js');

class Compare {

}

db.prepare()
  .then(() => {

  })
  .then(() => process.exit())
  .catch((e) => {
    console.error(e);
    process.exit();
  });
