const argon2 = require('argon2');
const read = require('read');
const db = require('./db.js');

function addUser(username, password, role) {
  if (!role) role = 'user';
  return argon2.hash(password).then((hash) => {
    return db.WebUser.create({
      username: username,
      password: hash,
      role: role,
      region: process.env.BIKEMOVES_REGION
    })
    .catch((err) => {
      throw (/^SequelizeUniqueConstraintError/.test(err)) ?
        `User ${username} already exists` : err;
    });
  });
}

function removeUser(username) {
  return db.WebUser.findOne({
    where: {
      username: username
    }
  }).then((user) => {
    if (!user) throw `User ${username} does not exist`;
    return user.destroy();
  });
}

function usageError(msg) {
  console.info(msg + '\n');
  console.info('Usage: user [add|remove] <username>');
  console.info('Example: user add janedoe');
  console.info('Example: user remove janedoe');
}

function silentPrompt(msg) {
  return new Promise((resolve, reject) => {
    read({
      prompt: msg,
      silent: true
    }, (err, value) => (err) ? reject(err) : resolve(value));
  });
}

if (require.main === module) {
  db.prepare().then(() => {
    let args = process.argv.slice(2);
    if (args.length !== 2)
      return usageError('Exactly two arguments are required');
    if (!args[0] || ['add', 'remove'].indexOf(args[0]) === -1)
      return usageError('First argument must be "add" or "remove"');

    let [command, username] = args;

    if (command === 'add') return silentPrompt(`Password for ${username}:`)
      .then((password) => addUser(username, password))
      .then(() => console.info(`User ${username} added`))
      .catch((err) => console.error(`Error adding user: ${err}`));

    if (command === 'remove') return removeUser(username)
      .then(() => console.info(`User ${username} removed`))
      .catch((err) => console.error(`Error removing user: ${err}`))
  })
  .then(() => process.exit());
}
