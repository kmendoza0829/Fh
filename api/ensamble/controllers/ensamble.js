const { parseMultipartData, sanitizeEntity } = require("strapi-utils");
module.exports = {
  /**
   * Create a record.
   *
   * @return {Object}
   */
  async findWithPedido(ctx) {
    let entities;
    try {
      const { idPedido, idProducto } = ctx.request.body;

      entities = await strapi.query("ensamble").model.aggregate([
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$pedido", { $toObjectId: idPedido }] },
                { $eq: ["$pedidoProducto", { $toObjectId: idProducto }] },
              ],
            },
          },
        },
        {
          $lookup: {
            from: "ensamble_piezas",
            let: { ensamble_id: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $and: [{ $eq: ["$ensamble", "$$ensamble_id"] }] },
                },
              },
            ],
            as: "piezas",
          },
        },
      ]);

      return entities.map((entity) =>
        sanitizeEntity(entity, { model: strapi.models.ensamble })
      );
    } catch (err) {
      console.log(err);
      return;
    }
  },
  async findByNameAndDate(ctx) {
    let entities = [];
    try {
      const { start, end } = ctx.request.body;
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
      entities = await strapi.query("ensamble").model.aggregate([
        ...dateBetweenPipe,
        { $match: { ok_start: true, ok_end: true } },
        { $group: {
          _id: {
            $toUpper: {
              $trim: {
                input: "$nombre"
              }
            }
          },
          data: {
            $push: { nombre: "$nombre", cantidad: "$cantidadEnsamblada", fecha: "$createdAt"}
          },
          total: {
            $sum: "$cantidadEnsamblada"
          }
        }}
      ]);
    } catch (error) {
      console.log(error);
    }
    return entities;
  },
  async putWithProducto(ctx) {
    let entity;
    try {
      const { idPedido, idProducto, pieza } = ctx.request.body;

      entity = await strapi.services.ensamble.find({
        pedido: idPedido,
        pedidoProducto: idProducto,
      });
      // console.log(entity);
      let ensamble;
      entity.map((en) => {
        const found = en.piezas.find((pi) => pi?.id === pieza.id);
        found && (ensamble = en);
      });
      if (!entity || !ensamble) throw new Error("no hay ensamble");
      const piezas = [];
      ensamble.piezas.map((p) => {
        p?.id !== pieza.id && piezas.push(p);
      });

      // console.log(ensamble);
      // console.log("///////////////////");
      console.log({ piezas });
      const id = ensamble.id;
      // console.log({ a: "a" + _id });
      console.log(await strapi.services.ensamble.findOne({ id }));
      await strapi.services.ensamble.update({ id }, { ...ensamble, piezas });

      return pieza;
    } catch (err) {
      console.log(err);
      return false;
    }
  },
  async create(ctx) {
    let entity;
    if (!ctx.request.body) return false;
    try {
      // console.log(ctx.request.body.piezas);
      const formatted = {
        ...ctx.request.body,
      };
      delete formatted.piezas;
      entity = await strapi.query("ensamble").model.create(formatted);
      const comercializables = ctx.request.body.piezas.filter(
        ({ producto }) => producto?.tipo === "comercializable"
      );
      const hechas = ctx.request.body.piezas.filter(
        ({ producto }) => producto?.tipo === "hecha"
      );
      const comercializables_operations = [];
      const hechas_operations = [];

      const updater = (viejo, nuevo, estado = "Pendiente") => {
        viejo.forEach(({ producto, cantidad }) => {
          const auxNuevo = {
            insertOne: {
              document: {
                idPieza: producto.id,
                nombre: producto.nombre,
                cantidad,
                codigoProducto: producto.codigoProducto,
                estado,
                ensamble: entity._id,
                tipo_producto: producto.id,
              },
            },
          };
          if (estado === "Pendiente") {
            delete auxNuevo.insertOne.document.idPieza;
          } else {
            delete auxNuevo.insertOne.document.tipo_producto;
          }
          nuevo.push(auxNuevo);
        });
      };

      updater(comercializables, comercializables_operations);
      updater(hechas, hechas_operations, "Hecho");

      await strapi
        .query("ensamble-piezas")
        .model.bulkWrite(comercializables_operations);
      await strapi.query("ensamble-piezas").model.bulkWrite(hechas_operations);
      const res = await strapi.query("ensamble").model.aggregate([
        {
          $match: {
            $expr: { $and: [{ $eq: ["$_id", { $toObjectId: entity._id }] }] },
          },
        },
        {
          $lookup: {
            from: "ensamble_piezas",
            let: { emp: "$_id" },
            pipeline: [
              {
                $match: { $expr: { $and: [{ $eq: ["$ensamble", "$$emp"] }] } },
              },
            ],
            as: "piezas",
          },
        },
        {
          $project: {
            piezas: "$piezas",
          },
        },
      ]);

      res.length &&
        (await Promise.all(
          res[0].piezas.map((pieza) =>
            strapi.services["productos-pendientes"].create({
              ensamble_pieza: pieza._id,
              codigoProducto: pieza.codigoProducto,
              cantidadPendiente: pieza.cantidad,
            })
          )
        ));

      return sanitizeEntity(entity, { model: strapi.models.ensamble });
    } catch (error) {
      console.log(error);
    }
  },
  async findBetween(ctx) {
    let entities;
    try {
      const { start, end } = ctx.request.body;
      entities = await strapi.query("ensamble").model.aggregate([
        {
          $lookup: {
            from: "pedidos",
            localField: "pedido",
            foreignField: "_id",
            as: "pedido",
          },
        },
        { $unwind: "$pedido" },
        {
          $set: {
            pedido: {
              _id: "$pedido._id",
              cliente: "$pedido.cliente",
              fecha: {
                $dateFromString: {
                  format: "%Y-%m-%d",
                  dateString: "$pedido.fecha",
                },
              },
              fechaEntregaFinal: {
                $dateFromString: {
                  format: "%Y-%m-%d",
                  dateString: "$pedido.fechaEntregaFinal",
                },
              },
            },
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
                if: { $gte: ["$pedido.fecha", "$selected.start"] },
                then: true,
                else: false,
              },
            },
            ok_end: {
              $cond: {
                if: { $lte: ["$pedido.fechaEntregaFinal", "$selected.end"] },
                then: true,
                else: false,
              },
            },
          },
        },
        {
          $match: {
            ok_start: true,
            ok_end: true,
          },
        },
        {
          $lookup: {
            from: "clientes",
            localField: "pedido.cliente",
            foreignField: "_id",
            as: "pedido.cliente",
          },
        },
        { $unwind: "$pedido.cliente" },
        {
          $lookup: {
            from: "pedido_productos",
            localField: "pedidoProducto",
            foreignField: "_id",
            as: "pedidoProducto",
          },
        },
        { $unwind: "$pedidoProducto" },
        {
          $group: {
            _id: {
              pedido: {
                _id: "$pedido._id",
                cliente: "$pedido.cliente",
                fecha: "$pedido.fecha",
                fechaEntregaFinal: "$pedido.fechaEntregaFinal",
                pedidoProducto: "$pedidoProducto",
              },
            },
            total: { $sum: "$cantidadEnsamblada" },
          },
        },
        {
          $project: {
            pedido: "$_id.pedido",
            total: "$total",
            _id: 0,
          },
        },
      ]);
      // .explain("executionStats");
      console.log(entities);
    } catch (error) {
      console.log(error);
    }
    return entities;
  },
};
