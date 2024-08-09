module.exports = {
  jwtSecret: process.env.JWT_SECRET || '7ca0e4c2-1875-4a76-b4b2-916ba13b05b6',
  jwt: {
    expiresIn: "1d",
  },
};