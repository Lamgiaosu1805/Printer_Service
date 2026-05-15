const AUTH_SECRET = process.env.API_SECRET;

module.exports = function authenticate(req, res, next) {
  const secret = req.headers['x-api-secret'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!secret || secret !== AUTH_SECRET) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized — thiếu hoặc sai x-api-secret header',
    });
  }
  next();
};
