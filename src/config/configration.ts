export default () => ({
  port: Number(process.env.PORT),

  nodeEnv: process.env.NODE_ENV,

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    accessSecret: process.env.ACCESS_TOKEN_SECRET,
    refreshSecret: process.env.REFRESH_TOKEN_SECRET,

    accessExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN,
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
  },

  frontend: {
    url: process.env.FRONTEND_URL,
  },
});
