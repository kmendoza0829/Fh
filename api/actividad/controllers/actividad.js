const { sanitizeEntity } = require("strapi-utils");

module.exports = {
  /**
   * Update a record.
   *
   * @return {Object}
   */
  async update(ctx) {
    const { id } = ctx.params;

    let entity;
    let actividad;
    let notificacion;

    if (ctx.is("multipart")) {
      const { data, files } = parseMultipartData(ctx);
      entity = await strapi.services.actividad.update({ id }, data, {
        files,
      });
    } else {
      if (ctx.request.body?.materiasPrimas) {
        ctx.request.body.existenMateriasPrimas = isNotEmpty(
          ctx.request.body.materiasPrimas
        );
      }
      if (ctx.request.body?.productosResultantes) {
        ctx.request.body.existenProductoResultante = isNotEmpty(
          ctx.request.body.productosResultantes
        );
      }

      // calcular el porcentajeProductoResultante despues de ser actualizado
      let sumaTotalRequerido = 0;
      let sumaTotalConforme = 0;

      if (ctx.request.body?.productosResultantes?.length) {
        ctx.request.body.productosResultantes.map((producto) => {
          sumaTotalRequerido += producto.totalRequerido;
          producto?.registrosProductoResultante.map((registro) => {
            sumaTotalConforme += registro.cantidadConforme;
          });
        });
        ctx.request.body.porcentajeProductoResultante = sumaTotalRequerido
          ? ((sumaTotalConforme * 100) / sumaTotalRequerido).toFixed(0)
          : 0;
      }

      entity = await strapi.services.actividad.update({ id }, ctx.request.body);

      const existe = await setExistenMateriasPrimas(id);
      if (existe) {
        entity = await strapi.services.actividad.update(
          { id },
          {
            existenMateriasPrimasPendientes: true,
          }
        );
      }

      actividad = await strapi.services.actividad.find();

      actualizarNotificaciones(actividad);

      entity.materiasPrimas = await actividadesConTipoMateriaPrima(entity);

      entity.productosResultantes = await obtenerEmpleadosProductosResultantes(
        entity
      );

      // actualizar notificaciones si existenMateriasPrimasPendientes
      async function actualizarNotificaciones(actividad) {
        try {
          let existenPendientes = false;
          for (var i = 0; i < actividad?.length; i++) {
            if (actividad[i].existenMateriasPrimasPendientes) {
              existenPendientes = true;
              break;
            }
          }
          if (existenPendientes) {
            notificacion = await strapi.query("notificaciones").find();
            if (notificacion[0].id) {
              await strapi
                .query("notificaciones")
                .update(
                  { id: notificacion[0].id },
                  { materiasPrimasPendientesActividades: true }
                );
            }
          } else {
            notificacion = await strapi.query("notificaciones").find();
            if (notificacion[0].id) {
              await strapi
                .query("notificaciones")
                .update(
                  { id: notificacion[0].id },
                  { materiasPrimasPendientesActividades: false }
                );
            }
          }
        } catch (error) {
          console.error(error);
        }
      }
      //agregar tipo materia prima a la respuesta (materias-primas-articulos-seleccionables)
      async function actividadesConTipoMateriaPrima(entity) {
        try {
          const materiasPrimas = await Promise.all(
            entity.materiasPrimas.map(async (materiaPrimaActividad) => {
              materiaPrimaActividad.materiaPrima.tipoMateriaPrima =
                await strapi.services[
                  "materias-primas-articulos-seleccionables"
                ].findOne({
                  id: materiaPrimaActividad.materiaPrima.tipoMateriaPrima,
                });

              return materiaPrimaActividad;
            })
          );
          return materiasPrimas;
        } catch (error) {
          console.log(error);
        }
      }
      // true si el valor tiene elementos
      function isNotEmpty(value) {
        if (!value) return false;
        return value?.length > 0;
      }
      //retorna los empleados de asignados a los productos resultantes
      async function obtenerEmpleadosProductosResultantes(entity) {
        return await Promise.all(
          entity.productosResultantes.map(async (productoResultante) => {
            productoResultante.responsable = await strapi.services[
              "empleados"
            ].findOne({
              id: productoResultante.responsable,
            });
            return productoResultante;
          })
        );
      }

      async function setExistenMateriasPrimas(id) {
        let existenMateriasPrimasPendientes = false;
        const entity = await strapi.services.actividad.findOne({ id });
        entity.materiasPrimas.map((materiaPrima) => {
          if (
            materiaPrima.pendiente > 0 ||
            materiaPrima.estado == "Pendiente"
          ) {
            existenMateriasPrimasPendientes = true;
          }
        });

        return existenMateriasPrimasPendientes;
      }
    }

    return sanitizeEntity(entity, { model: strapi.models.actividad });
  },

  async find(ctx) {
    let entities;
    if (ctx.query._q) {
      entities = await strapi.services.actividad.search(ctx.query);
    } else {
      entities = await strapi.services.actividad.find(ctx.query, [
        { path: "productosResultantes", populate: { path: "responsable" } },
      ]);
      let tiposMateriaPrima = [];
      entities.map((actividad) => {
        actividad.materiasPrimas.map((mp) => {
          tiposMateriaPrima.push(mp.materiaPrima.tipoMateriaPrima);
        });
      });

      tiposMateriaPrima = await strapi
        .query("materias-primas-articulos-seleccionables")
        .model.find({ _id: { $in: tiposMateriaPrima } });

      entities.map((actividad, i) => {
        actividad.materiasPrimas.map((mp, j) => {
          if (!mp.materiaPrima) return;
          let tmp = tiposMateriaPrima.find((t) => {
            return t._id.equals(mp.materiaPrima.tipoMateriaPrima);
          });
          entities[i].materiasPrimas[j].materiaPrima.tipoMateriaPrima = tmp;
        });
      });
    }

    return entities.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models.actividad })
    );
  },
  async findByDate(ctx) {
    let entities = [];
    try {
      const { start, end, actividades } = ctx.request.body;
      // pipe para filtrar por fecha
      const dateBetweenPipe = [
        {
          $set: {
            selected: {
              start: {
                $dateFromString: {
                  format: "%Y-%m-%d",
                  dateString: start,
                },
              },
              end: {
                $dateFromString: {
                  format: "%Y-%m-%d",
                  dateString: end,
                },
              },
            },
          },
        },
        {
          $set: {
            ok_start: {
              $cond: {
                if: { $gte: ["$createdAt", "$selected.start"] },
                then: true,
                else: false,
              },
            },
            ok_end: {
              $cond: {
                if: { $lte: ["$createdAt", "$selected.end"] },
                then: true,
                else: false,
              },
            },
          },
        },
      ];
      entities = await strapi.query("actividad").model.aggregate([
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$existenMateriasPrimas", true] },
                { $in: ["$nombreActividad", actividades] },
              ],
              // $and: [],
            },
          },
        },
        ...dateBetweenPipe,
        { $match: { ok_start: true, ok_end: true } },
        {
          $lookup: {
            from: "components_materias_primas_materias_primas",
            let: { materiasPrimas: "$materiasPrimas" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: [
                      "$_id",
                      {
                        $map: {
                          input: "$$materiasPrimas",
                          as: "mp",
                          in: "$$mp.ref",
                        },
                      },
                    ],
                    // $and: [],
                  },
                },
              },
              {
                $lookup: {
                  from: "materias_primas_articulos_seleccionables",
                  localField: "materiaPrima",
                  foreignField: "_id",
                  as: "materiaPrima",
                },
              },
              { $unwind: "$materiaPrima" },
            ],
            as: "materiasPrimas",
          },
        },

        {
          $group: {
            _id: "$materiasPrimas.materiaPrima",
            data: {
              $push: {
                actividad: "$nombreActividad",
                entregado: {
                  materiaPrima: "$materiasPrimas.materiaPrima._id",
                  cantidad: "$materiasPrimas.totalEntregado",
                },
                fecha: "$createdAt",
              },
            },
          },
        },
        { $unwind: "$_id" },
      ]);
    } catch (err) {
      console.log(err);
    }

    return entities;
  },
  async findPendientesPaginated(ctx) {
    let entities = [];
    try {
      const { page, filter = "" } = ctx.request.body;
      entities = await strapi.query("actividad").model.aggregate([
        {
          $match: {
            $expr: {
              $and: [{ $eq: ["$existenMateriasPrimasPendientes", true] }],
            },
          },
        },
        { $sort: { _id: 1 } },
        {
          $lookup: {
            from: "pedido_productos",
            let: { id: "$pedido_producto" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$id"],
                  },
                },
              },
              {
                $lookup: {
                  from: "pedidos",
                  localField: "pedido",
                  foreignField: "_id",
                  as: "pedido",
                },
              },
              {
                $project: {
                  numeroPedido: "$pedido.numeroPedido",
                  producto: "$nombre"
                },
              },
              { $unwind: "$producto" },
              { $unwind: "$numeroPedido" },
            ],
            as: "info_producto",
          },
        },
        { $unwind: "$info_producto" },
        {
          $addFields: {
            numeroPedido: {
              $toString: "$info_producto.numeroPedido",
            },
            producto: "$info_producto.producto"
          },
        },
        { $unwind: "$pedido_producto" },
        {
          $lookup: {
            from: "components_materias_primas_materias_primas",
            let: { materiasPrimas: "$materiasPrimas" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: [
                      "$_id",
                      {
                        $map: {
                          input: "$$materiasPrimas",
                          as: "mp",
                          in: "$$mp.ref",
                        },
                      },
                    ],
                    // $and: [],
                  },
                },
              },
              {
                $lookup: {
                  from: "materias_primas_articulos_seleccionables",
                  localField: "materiaPrima",
                  foreignField: "_id",
                  as: "materiaPrima",
                },
              },
              { $unwind: "$materiaPrima" },
            ],
            as: "materiasPrimas",
          },
        },
        {
          $match: {
            $or: [
              {
                nombreActividad: { $regex: filter, $options: "i" },
              },
              {
                numeroPedido: { $regex: filter, $options: "i" },
              },
              {
                producto: { $regex: filter, $options: "i" },
              },
              {
                "materiasPrimas.materiaPrima.item": { $regex: filter, $options: "i" },
              }
            ],
          },
        },
        { $skip: 10 * page },
        { $limit: 10 },
      ]);
    } catch (err) {
      console.log(err);
    }

    return entities;
  },
  async countPendientesPaginated(ctx) {
    let entities = [];
    try {
      const { filter = "" } = ctx.request.body;
      entities = await strapi.query("actividad").model.aggregate([
        {
          $match: {
            $expr: {
              $and: [{ $eq: ["$existenMateriasPrimasPendientes", true] }],
            },
          },
        },
        { $sort: { _id: 1 } },
        {
          $lookup: {
            from: "pedido_productos",
            let: { id: "$pedido_producto" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$id"],
                  },
                },
              },
              {
                $lookup: {
                  from: "pedidos",
                  localField: "pedido",
                  foreignField: "_id",
                  as: "pedido",
                },
              },
              {
                $project: {
                  numeroPedido: "$pedido.numeroPedido",
                  producto: "$nombre"
                },
              },
              { $unwind: "$producto" },
              { $unwind: "$numeroPedido" },
            ],
            as: "info_producto",
          },
        },
        { $unwind: "$info_producto" },
        {
          $addFields: {
            numeroPedido: {
              $toString: "$info_producto.numeroPedido",
            },
            producto: "$info_producto.producto"
          },
        },
        { $unwind: "$pedido_producto" },
        {
          $lookup: {
            from: "components_materias_primas_materias_primas",
            let: { materiasPrimas: "$materiasPrimas" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: [
                      "$_id",
                      {
                        $map: {
                          input: "$$materiasPrimas",
                          as: "mp",
                          in: "$$mp.ref",
                        },
                      },
                    ],
                    // $and: [],
                  },
                },
              },
              {
                $lookup: {
                  from: "materias_primas_articulos_seleccionables",
                  localField: "materiaPrima",
                  foreignField: "_id",
                  as: "materiaPrima",
                },
              },
              { $unwind: "$materiaPrima" },
            ],
            as: "materiasPrimas",
          },
        },
        {
          $match: {
            $or: [
              {
                nombreActividad: { $regex: filter, $options: "i" },
              },
              {
                numeroPedido: { $regex: filter, $options: "i" },
              },
              {
                producto: { $regex: filter, $options: "i" },
              },
              {
                "materiasPrimas.materiaPrima.item": { $regex: filter, $options: "i" },
              }
            ],
          },
        },
      ]);
    } catch (err) {
      console.log(err);
    }

    return entities.length || 0;
  },
  /**
   * find a record.
   *
   * @return {Object}
   */
  async findOne(ctx) {
    const { id } = ctx.params;

    const entity = await strapi.services.actividad.findOne({ id });

    //agregar tipo materia prima a la respuesta (materias-primas-articulos-seleccionables)
    try {
      if (entity.materiaPrima.length) {
        await Promise.all(
          entity.materiasPrimas.map(async (materiaPrimaActividad, index) => {
            const tipoMateriaPrima = await strapi.services[
              "materias-primas-articulos-seleccionables"
            ].findOne({
              id: materiaPrimaActividad.materiaPrima.tipoMateriaPrima,
            });

            entity.materiasPrimas[index].materiaPrima.tipoMateriaPrima =
              tipoMateriaPrima;

            return entity.materiasPrimas[index];
          })
        );
      }
    } catch (error) {
      console.log(error);
    }

    return sanitizeEntity(entity, { model: strapi.models.actividad });
  },
};
