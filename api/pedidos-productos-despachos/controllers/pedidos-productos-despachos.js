"use strict";
const { parseMultipartData, sanitizeEntity } = require("strapi-utils");

module.exports = {
  /**
   * Create a record.
   *
   * @return {Object}
   */

  async create(ctx) {
    let entity;
    if (ctx.is("multipart")) {
      const { data, files } = parseMultipartData(ctx);
      entity = await strapi.services.restaurant.create(data, { files });
    } else {
      const producto = await strapi.services["pedido-productos"].findOne({
        id: ctx.request.body.producto.id,
      });

      if (producto) {
        const cantidadProducto = producto.cantidad;
        const cantidadDespachadaProducto = producto.cantidadDespachada;

        const cantidadPorDespachar =
          cantidadProducto - cantidadDespachadaProducto;

        const cantidadResultanteADespachar =
          cantidadPorDespachar - ctx.request.body.cantidadDespachada;

        if (cantidadResultanteADespachar >= 0) {
          const asignar =
            ctx.request.body.cantidadDespachada + cantidadDespachadaProducto;

          //actualizar producto

          const productoActualizado = await strapi.services[
            "pedido-productos"
          ].update({ id: producto.id }, { cantidadDespachada: asignar });

          // crear registro

          entity = await strapi.services["pedidos-productos-despachos"].create(
            ctx.request.body
          );
        }
      }

      //entity = await strapi.services['pedidos-productos-despachos'].create(ctx.request.body);
    }
    return sanitizeEntity(entity, {
      model: strapi.models["pedidos-productos-despachos"],
    });
  },
  async delete(ctx) {
    const { id } = ctx.params;

    const despacho = await strapi.services[
      "pedidos-productos-despachos"
    ].findOne({ id });

    const producto = despacho.producto;

    // actualiza la cantidad despachada del producto cuando se elimina un registro de despacho producto

    console.log(producto.cantidadDespachada);
    const productoActualizado = await strapi.services[
      "pedido-productos"
    ].update(
      { id: producto.id },
      {
        cantidadDespachada:
          producto.cantidadDespachada - despacho.cantidadDespachada,
      }
    );
    console.log(productoActualizado.cantidadDespachada);

    const entity = await strapi.services["pedidos-productos-despachos"].delete({
      id,
    });
    return sanitizeEntity(entity, {
      model: strapi.models["pedidos-productos-despachos"],
    });
  },
};
