const { parseMultipartData, sanitizeEntity } = require("strapi-utils");

module.exports = {
  /**
   * Create a record.
   *
   * @return {Object}
   */

  async createProductosDesdeExcel(ctx) {
    let entity;
    try {
      const listaProductos = ctx.request.body;
      await strapi.query("pedido-productos-seleccionables").model.deleteMany({});
      let operaciones = [];
      listaProductos.map((producto) => {
        operaciones.push({
          insertOne: { document: producto },
        });
      });
      entity = await strapi
        .query("pedido-productos-seleccionables")
        .model.bulkWrite(operaciones);
    } catch (error) {
      console.log(error);
    }
    return sanitizeEntity(entity, {
      model: strapi.models["pedido-productos-seleccionables"],
    });
  },
};
