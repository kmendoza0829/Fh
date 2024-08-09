const { parseMultipartData, sanitizeEntity } = require('strapi-utils');

module.exports = {
  /**
   * Create a record.
   *
   * @return {Object}
   */

  async create(ctx) {
    let entity;
    try {
        const { tipoMateriaPrima, cantidad } = ctx.request.body;
        const tipoMp = await strapi
                                .services["materias-primas-articulos-seleccionables"]
                                .findOne({ id: tipoMateriaPrima })
        await strapi
                .services["materias-primas-articulos-seleccionables"]
                .update({ id: tipoMateriaPrima}, { stock: +tipoMp.stock + +cantidad })
        
        entity = await strapi.services["materias-primas-recepcion"].create(ctx.request.body);
    } catch (error) {
        console.log(error)
    }
    return sanitizeEntity(entity, { model: strapi.models["materias-primas-recepcion"] });
  },
  async update(ctx) {
    const { id } = ctx.params;

    let entity;
    try {
        const { tipoMateriaPrima, cantidad } = ctx.request.body;
        const tipoMp = await strapi
                                .services["materias-primas-articulos-seleccionables"]
                                .findOne({ id: tipoMateriaPrima })

        const old = await strapi.services["materias-primas-recepcion"].findOne({ id })

        if(!tipoMp.stock && typeof (tipoMp.stock) !== "number") throw new Error("No existe tipoMateriaPrima")

        const newStock = tipoMp.stock - (old.cantidad - cantidad)
        
        await strapi
            .services["materias-primas-articulos-seleccionables"]
            .update({ id: tipoMateriaPrima}, { stock: newStock })

        entity = await strapi.services["materias-primas-recepcion"].update({ id }, ctx.request.body);
    } catch (error) {
        console.log(error)
    }

    return sanitizeEntity(entity, { model: strapi.models["materias-primas-recepcion"] });
  },
};