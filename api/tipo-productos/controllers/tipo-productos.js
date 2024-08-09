const { sanitizeEntity } = require("strapi-utils");

module.exports = {
  /**
   * Create a record.
   *
   * @return {Object}
   */

  async createProductosDesdeExcel(ctx) {
    let entity;
    try {
      if (ctx.request.body.length) {
        // const tipoProductos = await strapi.services["tipo-productos"].find();

        // await strapi.query("tipo-productos").model.deleteMany({
        //   _id: { $in: tipoProductos.map((producto) => producto.id) },
        // });

        let operaciones = [];
        ctx.request.body.map((producto) => {
          operaciones.push({
            insertOne: {
              document: producto,
            },
          });
        });
        entity = await strapi
          .query("tipo-productos")
          .model.bulkWrite(operaciones);
      }
    } catch (error) {
      console.log(error);
    }
    return sanitizeEntity(entity, {
      model: strapi.models["tipo-productos"],
    });
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
      entities = await strapi.query("tipo-productos").model.aggregate([
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
            $push: { nombre: "$nombre", fecha: "$createdAt"}
          },
          total: {
            $sum: 1
          }
        }}
      ]);
    } catch (error) {
      console.log(error);
    }
    return entities;
  },
};
