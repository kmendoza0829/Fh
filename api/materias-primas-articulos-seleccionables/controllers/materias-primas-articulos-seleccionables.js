const { sanitizeEntity } = require("strapi-utils");
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async create(ctx) {
    let { create, del, update } = ctx.request.body;
    try {
      let actualesMP = await strapi.services[
        "materias-primas-recepcion"
      ].find();
      let parsedCreate = create.map((c) => c.codigo);
      let existen = await strapi
        .query("materias-primas-articulos-seleccionables")
        .model.find({ codigo: { $in: parsedCreate } });
      create = create.filter(
        (c) => !existen.find((e) => e.codigo === c.codigo)
      );
      del = del.filter((d) => {
        console.log({
          d,
          encontrado: !actualesMP.find(
            (a) => a.tipoMateriaPrima.codigo === d.codigo
          ),
        });
        return !actualesMP.find((a) => a.tipoMateriaPrima.codigo === d.codigo);
      });

      // formatear codigos
      del = del.map((d) => d.codigo);
      let codigosTobeUpdated = update.map((u) => u.codigo);
      console.log({ codigosTobeUpdated });
      // CREATE
      await strapi
        .query("materias-primas-articulos-seleccionables")
        .model.insertMany(create);
      // DELETE
      if(del.length){
        await strapi
          .query("materias-primas-articulos-seleccionables")
          .model.deleteMany({ codigo: { $in: del } });
      }
      // UPDATE
      let operaciones = [];
      update.forEach((u) => {
        console.log(u.item);
        operaciones.push({
          updateOne: { filter: { codigo: u.codigo }, update: { item: u.item } },
        });
      });

      await strapi
        .query("materias-primas-articulos-seleccionables")
        .model.bulkWrite(operaciones);
    } catch (error) {
      console.log(error);
    }
    return await strapi
      .query("materias-primas-articulos-seleccionables")
      .find({ _limit: -1 });
  },
};
