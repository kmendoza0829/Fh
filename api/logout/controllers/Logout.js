const utils = require("../../../utils/logs");
module.exports = {
  // GET /hello
  async desconectar(ctx) {
    ctx.send("logout");
    utils.file(null, "logout", null);
  },
};
