module.exports = ({ env }) => ({
    url: env('STRAPI_URL'),
    admin: {
      url: '/admin',
      auth: {
        secret: env('ADMIN_JWT_SECRET', '1367754eb70a271089d806bdd4dc3445'),
      },
    },
  });
  