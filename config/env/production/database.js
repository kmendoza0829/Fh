// module.exports = ({ env }) => ({
//   defaultConnection: "default",
//   connections: {
//     default: {
//       connector: "mongoose",
//       settings: {
//         host: env("DATABASE_HOST"),
//         srv: env.bool("DATABASE_SRV"),
//         port: env.int("DATABASE_PORT"),
//         database: env("DATABASE_NAME"),
//         username: env("DATABASE_USERNAME"),
//         password: env("DATABASE_PASSWORD"),
//       },
//       options: {
//         authenticationDatabase: env("AUTHENTICATION_DATABASE", null),
//         ssl: env.bool("DATABASE_SSL"),
//       },
//     },
//   },
// });

const path = require("path");

module.exports = ({ env }) => ({
  defaultConnection: "default",
  connections: {
    default: {
      connector: "mongoose",
      settings: {
        srv: env.bool('DATABASE_SRV', false),
        port: env.int('DATABASE_PORT', 27017),
        database: env('DATABASE_NAME', 'admin'),
        uri: `mongodb+srv://${env('DATABASE_USERNAME')}:${env('DATABASE_PASSWORD')}@${env('DATABASE_HOST')}&tls=true&tlsCAFile=${path.resolve(__dirname, 'ca-certificate.crt')}`,

      },
      options: {
        authenticationDatabase: env("AUTHENTICATION_DATABASE", "admin"),
        ssl: env.bool("DATABASE_SSL", true),
      },
    },
  },
});


// module.exports = ({ env }) => ({
//   defaultConnection: "default",
//   connections: {
//     default: {
//       connector: "bookshelf",
//       settings: {
//         client: "postgres",
//         host: env("DATABASE_HOST"),
//         port: env.int("DATABASE_PORT"),
//         database: env("DATABASE_NAME"),
//         username: env("DATABASE_USERNAME"),
//         password: env("DATABASE_PASSWORD"),
//         schema: env("DATABASE_SCHEMA", "public"), // Not Required
//         ssl: {
//           rejectUnauthorized: env.bool("DATABASE_SSL_SELF", false), // For self-signed certificates
//         },
//       },
//       options: {},
//     },
//   },
// });
