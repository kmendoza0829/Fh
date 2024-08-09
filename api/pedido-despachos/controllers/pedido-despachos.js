"use strict";
const { parseMultipartData, sanitizeEntity } = require("strapi-utils");
/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async createMultiplesDespachos(ctx) {
    let entity;
    let despachos = [];

    try {
      await Promise.all(
        Object.keys(ctx.request.body.pedidos).map(async (pedidoId) => {
          const productosDespacho = await Promise.all(
            ctx.request.body.pedidos[pedidoId].map(async (productoPedido) => {
              let productoDespacho = null;
              const producto = await strapi.services[
                "pedido-productos"
              ].findOne({
                id: productoPedido.id,
              });

              if (producto) {
                // ACTUALIZAR CANTIDAD DESPACHADA DEL PRODUCTO
                const pedidosProductosDespachos = await strapi
                  .query("pedidos-productos-despachos")
                  .find({
                    _where: {
                      "pedido_despacho.pedido": producto.pedido.id,
                      "producto.id": producto.id,
                    },
                  });

                //calcular la suma de todas las cantidad de ese producto asociado a un pedido
                let cantidadDespachadaProducto = 0;
                pedidosProductosDespachos.map((pedidosProductosDespacho) => {
                  cantidadDespachadaProducto +=
                    pedidosProductosDespacho.cantidadDespachada;
                });
                // cantidad producto
                const cantidadProducto = producto.cantidad;

                // cantidad por despachar del producto
                const cantidadPorDespachar =
                  cantidadProducto - cantidadDespachadaProducto;

                // cantidad disponible por despachar

                // console.log(
                //   { cantidadDespachadaProducto },
                //   { cantidadProducto },
                //   { cantidadPorDespachar },
                //   {
                //     "cantidad a despachar": Number(
                //       productoPedido.cantidadADespachar
                //     ),
                //   }
                // );

                const cantidadResultanteADespachar =
                  cantidadPorDespachar -
                  Number(productoPedido.cantidadADespachar);
                // si existe cantidad disponible para despachar actualiza la cantidad despachada del producto
                if (cantidadResultanteADespachar >= 0) {
                  let productoActualizado = await strapi.services[
                    "pedido-productos"
                  ].update(
                    { id: producto.id },
                    {
                      cantidadDespachada:
                        Number(productoPedido.cantidadADespachar) +
                        cantidadDespachadaProducto,
                    }
                  );

                  //crea el registro
                  productoDespacho = await strapi.services[
                    "pedidos-productos-despachos"
                  ].create({
                    producto: productoPedido.id,
                    cantidadDespachada: Number(
                      productoPedido.cantidadADespachar
                    ),
                  });
                }
              }
              return productoDespacho;
            })
          );

          const autoincremental = await strapi.query("autoincremental").find();

          const id = autoincremental[0].id;
          const remision = autoincremental[0].remision;

          await strapi
            .query("autoincremental")
            .update({ id }, { remision: remision + 1 });

          let dataDespacho = {
            pedidoProductosDespachos: productosDespacho,
            fecha: ctx.request.body.fecha,
            hora: ctx.request.body.hora ? ctx.request.body.hora : null,
            envio: ctx.request.body.envio,
            elaboro: ctx.request.body.elaboro,
            pedido: pedidoId,
            numeroRemision: (remision + 1).toString(),
          };

          if (dataDespacho.envio === "mensajeria") {
            dataDespacho.empresa = ctx.request.body.empresa;
            dataDespacho.numeroGuia = ctx.request.body.numeroGuia;
          } else {
            dataDespacho.conductor = ctx.request.body.conductor.id;
            dataDespacho.placa = ctx.request.body.placa;
            dataDespacho.telefono = ctx.request.body.telefono;
          }

          const despacho = await strapi.services["pedido-despachos"].create({
            ...dataDespacho,
          });

          despachos.push(despacho);
        })
      );
    } catch (error) {
      console.log(error);
    }
    entity = despachos;

    return sanitizeEntity(entity, { model: strapi.models["pedido-despachos"] });
  },
  async findOne(ctx) {
    const { id } = ctx.params;
    let entity;
    try {
      entity = await strapi.services["pedido-despachos"].findOne({ id });

      entity.pedido = await strapi.services["pedidos"].findOne({
        id: entity.pedido.id,
      });

      // agrega la informacion de los productos pedido
      entity.pedidoProductosDespachos = await Promise.all(
        entity.pedidoProductosDespachos.map(async (productoDespacho) => {
          const producto = await strapi.services["pedido-productos"].findOne({
            id: productoDespacho.producto,
          });
          return { ...productoDespacho, producto };
        })
      );
    } catch (error) {
      console.log(error);
    }

    return sanitizeEntity(entity, { model: strapi.models["pedido-despachos"] });
  },
  async delete(ctx) {
    const { id } = ctx.params;

    const entity = await strapi.services["pedido-despachos"].delete({ id });

    try {
      if (entity.pedidoProductosDespachos.length) {
        await Promise.all(
          entity.pedidoProductosDespachos.map(
            async (pedidoProductosDespacho) => {
              const producto = await strapi.services[
                "pedido-productos"
              ].findOne({
                id: pedidoProductosDespacho.producto,
              });

              await strapi.services["pedido-productos"].update(
                { id: producto.id },
                {
                  cantidadDespachada:
                    producto.cantidadDespachada -
                    pedidoProductosDespacho.cantidadDespachada,
                }
              );

              await strapi.services["pedidos-productos-despachos"].delete({
                id: pedidoProductosDespacho.id,
              });
            }
          )
        );
      }
    } catch (error) {
      console.log(error);
    }

    return sanitizeEntity(entity, { model: strapi.models["pedido-despachos"] });
  },
};
