const crypto = require('crypto');

function validateCsrfToken(req) {
  const requestToken = (req.body && req.body._csrf) || req.get('x-csrf-token');
  const sessionToken = req.session && req.session.csrfToken;
  if (!requestToken || !sessionToken || !/^[a-f0-9]{64}$/i.test(requestToken) || !/^[a-f0-9]{64}$/i.test(sessionToken)) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(requestToken, 'hex'), Buffer.from(sessionToken, 'hex'));
}

module.exports = { validateCsrfToken };
