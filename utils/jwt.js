const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      // Add any other claims you want here
    },
    process.env.JWT_SECRET, // Make sure you set this in your .env file
    { expiresIn: '7d' } // Token valid for 7 days
  );
};

module.exports = generateToken;
