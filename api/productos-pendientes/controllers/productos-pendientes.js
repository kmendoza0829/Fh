"use strict";
const { sanitizeEntity } = require("strapi-utils");
/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async find(ctx) {
    let entities;
    if (ctx.query._q) {
      entities = await strapi.services["productos-pendientes"].search(
        ctx.query
      );
    } else {
      //entities = await strapi.services["productos-pendientes"].find(ctx.query);
      try {
        entities = await strapi
          .query("productos-pendientes")
          .model.find()
          .populate([
            {
              path: "pedido_producto",
              select: "pedido",
              populate: {
                path: "pedido",
                select: "numeroPedido",
              },
            },
            {
              path: "ensamble_pieza",
              populate: {
                path: "ensamble",
                select: "pedido",
                populate: {
                  path: "pedido",
                  select: "numeroPedido",
                },
              },
            },
          ])
          .exec();

        // busca los productos del alamacen
        let productos = await Promise.all(
          entities.map(async (entity) => {
            const producto = await strapi
              .query("tipo-productos")
              .model.find({ codigoProducto: { $eq: entity.codigoProducto } });
            return producto;
          })
        );
        //agregar detalles de los productos a los pendientes y
        //filtra los pendientes de producto que no existan en el almacen o se hayan eliminado
        entities = entities
          .map((entity, index) => {
            const { _doc } = entity;
            return {
              ..._doc,
              producto: productos[index]?.length ? productos[index][0] : null,
            };
          })
          .filter((entity) => {
            return entity?.producto != null;
          });
      } catch (error) {
        console.log(error);
      }
    }

    return entities.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models["productos-pendientes"] })
    );
  },
};
