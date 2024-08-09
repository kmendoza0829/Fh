const { parseMultipartData, sanitizeEntity } = require("strapi-utils");

module.exports = {
  /**
   * Retrieve records.
   *
   * @return {Array}
   */

  async find(ctx) {
    let entities;
    if (ctx.query._q) {
      entities = await strapi.services["control-empleados"].search(ctx.query);
    } else {
      entities = await strapi.services["control-empleados"].find(ctx.query);
    }
    return entities.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models["control-empleados"] })
    );
  },
  async findBetween(ctx) {
    let entities = [];
    try {
      const { start, end, empleados } = ctx.request.body;
      entities = await strapi.query("control-empleados").model.aggregate([
        {
          $match: {
            $expr: {
              $and: [
                {
                  $in: [
                    "$empleado",
                    {
                      $map: {
                        input: empleados,
                        as: "emp",
                        in: { $toObjectId: "$$emp" },
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
        {
          $set: {
            fechaIngreso: {
              $dateFromString: {
                format: "%Y-%m-%dT%H:%M:%S",
                dateString: {
                  $concat: ["$fechaIngreso", "T", "$horaIngreso"],
                },
              },
            },
            fechaSalida: {
              $dateFromString: {
                format: "%Y-%m-%dT%H:%M:%S",
                dateString: {
                  $concat: ["$fechaSalida", "T", "$horaSalida"],
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
                if: { $gte: ["$fechaIngreso", "$selected.start"] },
                then: true,
                else: false,
              },
            },
            ok_end: {
              $cond: {
                if: { $lte: ["$fechaSalida", "$selected.end"] },
                then: true,
                else: false,
              },
            },
          },
        },
        { $match: { ok_start: true, ok_end: true } },
        {
          $lookup: {
            from: "empleados",
            localField: "empleado",
            foreignField: "_id",
            as: "empleado",
          },
        },
        { $unwind: "$empleado" },
        {
          $group: {
            _id: {
              empleado: "$empleado",
            },
            // [21/5/21 , 21/5/21]
            // [21/5/21 , 21/5/21]
            // [06:12:21 , 05:12:21]
            // [07:12:21 , 07:12:21,]
            // [1 , 2]
            fechaIngreso: { $push: "$fechaIngreso" },
            fechaSalida: { $push: "$fechaSalida" },
            horaIngreso: { $push: "$horaIngreso" },
            horaSalida: { $push: "$horaSalida" },
            horas: {
              $push: {
                $round: [{
                  $divide: [
                    { $subtract: ["$fechaSalida", "$fechaIngreso"] },
                    3600000,
                  ]
                }, 2]
              },
            },
            total: {
              $sum: {
                $divide: [
                  { $subtract: ["$fechaSalida", "$fechaIngreso"] },
                  3600000,
                ]
              },
            },
          },
        },
        {
          $project: {
            empleado: "$_id.empleado",
            fechaIngreso: "$fechaIngreso",
            fechaSalida: "$fechaSalida",
            horaIngreso: "$horaIngreso",
            horaSalida: "$horaSalida",
            horas: "$horas",
            total: "$total",
            _id: 0,
          },
        },
      ]);
      // .explain("executionStats");
    } catch (error) {
      console.log(error);
    }
    return entities;
  },
  async findBetweenRecargos(ctx) {
    let entities = [];
    try {
      const { start, end } = ctx.request.body;
      entities = await strapi.query("control-empleados").model.aggregate([
        {
          $match: {
            fechaSalida: { "$exists": true, "$ne": "" }
          },
        },
        {
          $set: {
            fechaIngreso: {
              $dateFromString: {
                format: "%Y-%m-%dT%H:%M:%S",
                dateString: {
                  $concat: ["$fechaIngreso", "T", "$horaIngreso"],
                },
              },
            },
            fechaSalida: {
              $dateFromString: {
                format: "%Y-%m-%dT%H:%M:%S",
                dateString: {
                  $concat: ["$fechaSalida", "T", "$horaSalida"],
                },
              },
            },
            selected: {
              start: {
                $dateFromString: {
                  format: "%Y-%m-%dT%H:%M:%S",
                  dateString: {
                    $concat: [start, "T", "23:59:59"]
                  },
                },
              },
              end: {
                $dateFromString: {
                  format: "%Y-%m-%dT%H:%M:%S",
                  dateString: {
                    $concat: [end, "T", "23:59:59"]
                  },
                },
              },
            },
          },
        },
        {
          $set: {
            ok_start: {
              $cond: {
                if: { $gte: ["$fechaIngreso", "$selected.start"] },
                then: true,
                else: false,
              },
            },
            ok_end: {
              $cond: {
                if: { $lte: ["$fechaSalida", "$selected.end"] },
                then: true,
                else: false,
              },
            },
          },
        },
        { $match: { ok_start: true, ok_end: true } },
        {
          $lookup: {
            from: "empleados",
            localField: "empleado",
            foreignField: "_id",
            as: "empleado",
          },
        },
        { $unwind: "$empleado" },
        {
          $project: {
            _id: "$_id",
            fechaIngreso: "$fechaIngreso",
            fechaSalida: "$fechaSalida",
            turno: "$turno",
            empleado: {
              _id: "$empleado._id",
              nombre: "$empleado.nombreEmpleado",
              active: "$empleado.active",
            },
          }
        },
        {
          $match: {
            $expr: {
              $eq: ["$empleado.active", true]
            }
          }
        }
      ]);
      // .explain("executionStats");
    } catch (error) {
      console.log(error);
    }
    return entities;
  },
  async create(ctx) {
    let entity;
    if (ctx.is("multipart")) {
      const { data, files } = parseMultipartData(ctx);
      entity = await strapi.services["control-empleados"].create(data, {
        files,
      });
    } else {
      try {
        let { empleadoId } = ctx.params;
        let empleado = await strapi.services.empleados.findOne({
          id: empleadoId,
        });
        if (empleado.trabajando) {
          console.log({ a: empleado.controlEmpleadoActual })
          entity = await strapi.services["control-empleados"].update(
            { id: empleado.controlEmpleadoActual._id },
            ctx.request.body
          );
          await strapi.services.empleados.update(
            { id: empleado.id },
            {
              trabajando: false,
              controlEmpleadoActual: null,
            }
          );
        } else {
          entity = await strapi.services["control-empleados"].create({
            ...ctx.request.body,
            empleado: empleado.id,
          });
          await strapi.services.empleados.update(
            { id: empleado._id || empleado },
            { trabajando: true, controlEmpleadoActual: entity }
          );
        }
      } catch (error) {
        console.log("ERROR --->", error);
      }
    }
    return sanitizeEntity(entity, {
      model: strapi.models["control-empleados"],
    });
  },
  async delete(ctx) {
    const { id, empleado } = ctx.params;
    try {
      const empleadoObj = await strapi.services.empleados.findOne({
        id: empleado,
      });
      if (empleadoObj.trabajando) {
        throw new Error("empleado trabajando");
      }
      const entity = await strapi.services["control-empleados"].delete({ id });
      return sanitizeEntity(entity, {
        model: strapi.models["control-empleados"],
      });
    } catch (error) {
      console.log(error);
    }
  },
};
