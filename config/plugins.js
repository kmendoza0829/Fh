module.exports = ({ env }) => ({
  email: {
    provider: "sendgrid",
    providerOptions: {
    },
    settings: {
      defaultFrom: "jhonsebastianmora@gmail.com",
      defaultReplyTo: "jhonsebastianmora@gmail.com",
    },
  },
});
