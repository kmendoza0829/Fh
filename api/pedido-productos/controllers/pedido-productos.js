const { sanitizeEntity } = require("strapi-utils");

module.exports = {
  async create(ctx) {
    let entity;
    if (ctx.is("multipart")) {
      const { data, files } = parseMultipartData(ctx);
      entity = await strapi.services["pedido-productos"].create(data, {
        files,
      });
    } else {
      entity = await strapi.services["pedido-productos"].create(
        ctx.request.body
      );
      if (!entity.esComercializable) {
        try {
          const actividadesLista = [
            { nombreActividad: "corte" },
            { nombreActividad: "punzonado" },
            { nombreActividad: "roscado" },
            { nombreActividad: "figurado" },
            { nombreActividad: "marcado" },
            { nombreActividad: "soldadura" },
            { nombreActividad: "inyeccion" },
            { nombreActividad: "galvanizado" },
            { nombreActividad: "pintura" },
            { nombreActividad: "fundicion" },
          ];

          // PIEZAS SOBRANTES
          let operacionesSobrantes = [];
          actividadesLista.map((actividad) => {
            operacionesSobrantes.push({
              insertOne: { document: { piezasSobrantes: [] } },
            });
          });
          const piezasSobrantes = await strapi
            .query("actividad-piezas-sobrantes")
            .model.bulkWrite(operacionesSobrantes);

          // ACTIVIDADES
          let operaciones = [];
          actividadesLista.map((actividad, index) => {
            operaciones.push({
              insertOne: {
                document: {
                  ...actividad,
                  actividadPiezasSobrantes:
                    piezasSobrantes.result.insertedIds[index]._id,
                },
              },
            });
          });
          const actividades = await strapi
            .query("actividad")
            .model.bulkWrite(operaciones);
          entity = await strapi.services["pedido-productos"].update(
            { id: entity.id },
            {
              actividades: actividades.result.insertedIds.map(
                (actividad, index) => {
                  return actividad._id;
                }
              ),
            }
          );
        } catch (error) {
          console.log(error);
        }
      } else {
        const { codigoProducto, cantidad } = entity;

        await strapi.services["productos-pendientes"].create({
          pedido_producto: entity.id,
          codigoProducto,
          cantidadPendiente: cantidad,
        });
      }
    }
    return sanitizeEntity(entity, { model: strapi.models["pedido-productos"] });
  },
  async findOne(ctx) {
    const { id } = ctx.params;

    const entity = await strapi.services["pedido-productos"].findOne({ id });

    //agregar detalles despacho al producto
    const despachos = await strapi.services["pedidos-productos-despachos"].find(
      { "producto.id_eq": entity.id }
    );
    entity.despachos = despachos;

    return sanitizeEntity(entity, { model: strapi.models["pedido-productos"] });
  },
  async delete(ctx) {
    const { id } = ctx.params;

    let producto = await strapi.services["pedido-productos"].findOne({ id });

    try {
      //eliminar productos
      if (producto.actividades.length) {
        //obtener actividades producto
        producto.actividades = await Promise.all(
          producto.actividades.map(async (actividad) => {
            const actividadRes = await strapi.services.actividad.findOne({
              id: actividad,
            });
            return actividadRes;
          })
        );

        if (producto.actividades.length) {
          //eliminar los productos resultantes de las actividades
          await Promise.all(
            producto.actividades.map(async (actividad) => {
              if (actividad.productosResultantes.length) {
                //eliminar registros producto resultante
                await Promise.all(
                  actividad.productosResultantes.map(async (resultante) => {
                    await strapi.services["producto-resultante"].update(
                      { id: resultante.id },
                      {
                        registrosProductoResultante: [],
                      }
                    );
                  })
                );

                await deleteObjectsCollection(
                  actividad.productosResultantes,
                  "producto-resultante"
                );
              }
              //eliminar las materias primas
              if (actividad.materiasPrimas.length) {
                await strapi.services.actividad.update(
                  { id: actividad.id },
                  {
                    materiasPrimas: [],
                  }
                );
              }
            })
          );
          // eliminar las actividades
          await deleteObjectsCollection(producto.actividades, "actividad");
        }

        if (producto.despachos.length) {
          //eliminar pedidos despacho
          await Promise.all(
            producto.despachos.map(async (despacho) => {
              if (despacho.pedido_despacho) {
                await deleteObjectsCollection(
                  [despacho.pedido_despacho],
                  "pedido-despachos"
                );
              }
            })
          );

          //eliminar despachos del producto
          await deleteObjectsCollection(
            producto.despachos,
            "pedidos-productos-despachos"
          );
        }
      }

      //eliminar pedido
      producto = await strapi.services["pedido-productos"].delete({
        id: producto.id,
      });
    } catch (error) {
      console.log(error);
    }

    async function deleteObjectsCollection(objects, collection) {
      if (objects.length) {
        let invalid = false;
        // si es un array de null retorna null, si no , elimina los objetos
        const objectsArray = objects.map((object) => {
          if (object === null) {
            invalid = true;
            return null;
          }
          return object._id;
        });

        if (invalid) {
          return null;
        }

        return strapi
          .query(collection)
          .model.deleteMany({ _id: { $in: objectsArray } });
      }
    }

    // async function deleteFiles(archivos) {
    //   await Promise.all(
    //     archivos.map(async (archivo) => {
    //       const file = await strapi.plugins["upload"].services.upload.fetch({
    //         id: archivo.id,
    //       });
    //       await strapi.plugins["upload"].services.upload.remove(file);
    //     })
    //   );
    // }

    return sanitizeEntity(producto, {
      model: strapi.models["pedido-productos"],
    });
  },
  async getProductosAll(ctx) {
    const pedidoProductos = await strapi.query("pedido-productos").model.aggregate([
      {
        $project: {
          codigoProducto: "$codigoProducto",
          nombre: "$nombre",
        }
      }
    ])

    // const pedidoProductosSeleccionables = await strapi.query("pedido-productos-seleccionables").model.aggregate([
    //   {
    //     $project: {
    //       codigoProducto: "$codigoProducto",
    //       nombre: "$nombre",
    //     }
    //   }
    // ])

    // sort by nombre and join
    const productos = pedidoProductos/*.concat(pedidoProductosSeleccionables)*/.sort((a, b) => a.nombre.localeCompare(b.nombre))

    // remove duplicates by codigoProducto
    const uniqueProductos = productos.filter((producto, index, self) => index === self.findIndex((t) => (t.codigoProducto.trim() === producto.codigoProducto.trim())))

    return sanitizeEntity(uniqueProductos, { model: strapi.models["pedido-productos"] });
  },
};
