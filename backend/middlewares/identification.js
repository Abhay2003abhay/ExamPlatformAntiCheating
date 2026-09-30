const jwt = require('jsonwebtoken');

exports.identifier = (req, res, next) => {
  let token;
  if (req.headers.client === 'not-browser') {
    token = req.headers.authorization;
  } else {
    token = req.cookies['Authorization'];
  }

  if (!token) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const userToken = token.split(' ')[1];
    req.user = jwt.verify(userToken, process.env.TOKEN_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};
