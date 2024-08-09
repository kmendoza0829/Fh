module.exports = {
  load: {
    before: ["responseTime", "logger", "cors", "responses"],
    order: [
      "Define the middlewares' load order by putting their name in this array in the right order",
    ],
    after: ["parser", "router"],
  },
  settings: {
    cors: {
      enabled: true,
      origin: ["*"],
    },
    config: {
      formLimit: "256mb", // modify form body
      jsonLimit: "256mb", // modify JSON body
      textLimit: "256mb", // modify text body
      formidable: {
        maxFileSize: 3072 * 1024 * 1024, // multipart data, modify here limit of uploaded file size
      },
    },
  },
};
