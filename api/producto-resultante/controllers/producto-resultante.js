"use strict";

const { sanitizeEntity } = require("strapi-utils");

module.exports = {
  /**
   * Retrieve records.
   *
   * @return {Array}
   */

  async find(ctx) {
    let entities;
    if (ctx.query._q) {
      entities = await strapi.services["producto-resultante"].search(ctx.query);
    } else {
      entities = await strapi.services["producto-resultante"].find(ctx.query, [
        { path: "responsable", populate: { path: "controlEmpleados" } },
      ]);
    }

    return entities.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models["producto-resultante"] })
    );
  },
  async findByDate(ctx) {
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
      entities = await strapi.query("producto-resultante").model.aggregate([
        ...dateBetweenPipe,
        { $match: { ok_start: true, ok_end: true } },
        {
          $lookup: {
            from: "components_productos_resultantes_registros_producto_resultantes",
            let: { ref: "$registrosProductoResultante.ref" },
            pipeline: [
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
                  fecha: {
                    $dateFromString: {
                      format: "%Y-%m-%d",
                      dateString: "$fecha",
                    },
                  },
                },
              },
              {
                $set: {
                  ok: {
                    $and: [
                      { $gte: ["$fecha", "$selected.start"] },
                      { $lte: ["$fecha", "$selected.end"] },
                    ],
                  },
                },
              },
              // match ok_start, ok_end and ref with _id
              {
                $match: {
                  $expr: {
                    $and: ["$ok", { $in: ["$_id", "$$ref"] }],
                  },
                },
              },
            ],
            // localField: "registrosProductoResultante.ref",
            // foreignField: "_id",
            as: "registrosProductoResultante",
          },
        },
        // filter with $match registrosProductoResultante empty array
        {
          $match: {
            $expr: {
              $ne: [{ $size: "$registrosProductoResultante" }, 0],
            },
          },
        },
        {
          $lookup: {
            from: "control_empleados",
            pipeline: [
              ...dateBetweenPipe,
              // convierte Strings en Fechas
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
                },
              },
              // Deja las horas que hay entre fecha de inicio y fecha final
              {
                $set: {
                  horas: {
                    $sum: {
                      $round: [
                        {
                          $divide: [
                            { $subtract: ["$fechaSalida", "$fechaIngreso"] },
                            3600000,
                          ],
                        },
                        2,
                      ],
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
              {
                $match: {
                  $expr: {
                    $and: ["$ok_start", "$ok_end"],
                  },
                },
              },
            ],
            as: "controlEmpleados",
          },
        },
        // trae los datos del responsable
        {
          $lookup: {
            from: "empleados",
            localField: "registrosProductoResultante.responsable",
            foreignField: "_id",
            as: "responsables",
          },
        },
        {
          $addFields: {
            data: {
              // recorre los responsables
              $map: {
                input: "$responsables",
                as: "responsable",
                in: {
                  // deja los controlEmpleados que sean del responsable y esten dentro del rango de fechas
                  controlEmpleados: {
                    $filter: {
                      input: "$controlEmpleados",
                      as: "ce",
                      cond: {
                        $eq: ["$$ce.empleado", "$$responsable._id"],
                      },
                    },
                  },
                  // deja los registros de producto resultante que sean del responsable
                  registrosProductoResultante: {
                    $filter: {
                      input: "$registrosProductoResultante",
                      as: "rpr",
                      cond: {
                        $eq: ["$$rpr.responsable", "$$responsable._id"],
                      },
                    },
                  },
                  // deja el responsable
                  responsable: "$$responsable",
                },
              },
            },
          },
        },
        {
          $group: {
            _id: {
              $first: "$data.responsable",
            },
            controlEmpleados: {
              $addToSet: "$data.controlEmpleados",
            },
            registrosProductoResultante: {
              $addToSet: "$data.registrosProductoResultante",
            },
          },
        },
        // PARA ELIMINAR ARRAY DENTRO DE ARRAY
        {
          $unwind: {
            path: "$controlEmpleados",
            includeArrayIndex: "arrayIndex", // optional
            preserveNullAndEmptyArrays: false, // optional
          },
        },
        {
          $unwind: {
            path: "$controlEmpleados",
            includeArrayIndex: "arrayIndex", // optional
            preserveNullAndEmptyArrays: false, // optional
          },
        },
        {
          $unwind: {
            path: "$controlEmpleados",
            includeArrayIndex: "arrayIndex", // optional
            preserveNullAndEmptyArrays: false, // optional
          },
        },
        {
          $unwind: {
            path: "$registrosProductoResultante",
            includeArrayIndex: "arrayIndex", // optional
            preserveNullAndEmptyArrays: false, // optional
          },
        },
        {
          $unwind: {
            path: "$registrosProductoResultante",
            includeArrayIndex: "arrayIndex", // optional
            preserveNullAndEmptyArrays: false, // optional
          },
        },
        {
          $unwind: {
            path: "$registrosProductoResultante",
            includeArrayIndex: "arrayIndex", // optional
            preserveNullAndEmptyArrays: false, // optional
          },
        },
        // AGRUPAR
        {
          $group: {
            _id: {
              _id: "$_id._id",
              nombre: "$_id.nombreEmpleado",
              active: "$_id.active",
            },
            controlEmpleados: {
              $addToSet: "$controlEmpleados",
            },
            registrosProductoResultante: {
              $addToSet: "$registrosProductoResultante",
            },
          },
        },
        {
          $match: {
            $expr: {
              $eq: ["$_id.active", true],
            },
          },
        },
      ]);
      // .explain("executionStats");
    } catch (error) {
      console.log(error);
    }
    return entities;
  },
  async findByDateGalvanizado(ctx) {
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
      entities = await strapi.query("producto-resultante").model.aggregate([
        ...dateBetweenPipe,
        { $match: { ok_start: true, ok_end: true } },
        {
          $lookup: {
            from: "actividades",
            let: { ref: "$actividad" },
            pipeline: [
              // lookup actividad if nombreActividad is galvanizado
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ["$_id", "$$ref"] }],
                  },
                },
              },
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ["$nombreActividad", "galvanizado"] }],
                  },
                },
              },
              // {
              //   $limit: 1,
              // },
              // {
              //   $set: {
              //     ref: "$$ref",
              //     in: {
              //       $eq: ["$_id", "$$ref"],
              //     },
              //   },
              // },
            ],
            as: "actividad",
          },
        },
        {
          $match: {
            // filter $actividad empty array
            $expr: {
              $ne: [{ $size: "$actividad" }, 0],
            },
          },
        },

        {
          $lookup: {
            from: "components_productos_resultantes_registros_producto_resultantes",
            let: { ref: "$registrosProductoResultante.ref" },
            pipeline: [
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
                  fecha: {
                    $dateFromString: {
                      format: "%Y-%m-%d",
                      dateString: "$fecha",
                    },
                  },
                },
              },
              {
                $set: {
                  ok: {
                    $and: [
                      { $gte: ["$fecha", "$selected.start"] },
                      { $lte: ["$fecha", "$selected.end"] },
                    ],
                  },
                },
              },
              // match ok_start, ok_end and ref with _id
              {
                $match: {
                  $expr: {
                    $and: ["$ok", { $in: ["$_id", "$$ref"] }],
                  },
                },
              },
            ],
            // localField: "registrosProductoResultante.ref",
            // foreignField: "_id",
            as: "registrosProductoResultante",
          },
        },
        // filter with $match registrosProductoResultante empty array
        {
          $match: {
            $expr: {
              $ne: [{ $size: "$registrosProductoResultante" }, 0],
            },
          },
        },
        {
          $lookup: {
            from: "control_empleados",
            pipeline: [
              ...dateBetweenPipe,
              // convierte Strings en Fechas
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
                },
              },
              // Deja las horas que hay entre fecha de inicio y fecha final
              {
                $set: {
                  horas: {
                    $sum: {
                      $round: [
                        {
                          $divide: [
                            { $subtract: ["$fechaSalida", "$fechaIngreso"] },
                            3600000,
                          ],
                        },
                        2,
                      ],
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
              {
                $match: {
                  $expr: {
                    $and: ["$ok_start", "$ok_end"],
                  },
                },
              },
            ],
            as: "controlEmpleados",
          },
        },
        // trae los datos del responsable
        {
          $lookup: {
            from: "empleados",
            localField: "registrosProductoResultante.responsable",
            foreignField: "_id",
            as: "responsables",
          },
        },
        {
          $addFields: {
            data: {
              // recorre los responsables
              $map: {
                input: "$responsables",
                as: "responsable",
                in: {
                  // deja los controlEmpleados que sean del responsable y esten dentro del rango de fechas
                  controlEmpleados: {
                    $filter: {
                      input: "$controlEmpleados",
                      as: "ce",
                      cond: {
                        $eq: ["$$ce.empleado", "$$responsable._id"],
                      },
                    },
                  },
                  // deja los registros de producto resultante que sean del responsable
                  registrosProductoResultante: {
                    $filter: {
                      input: "$registrosProductoResultante",
                      as: "rpr",
                      cond: {
                        $eq: ["$$rpr.responsable", "$$responsable._id"],
                      },
                    },
                  },
                  // deja el responsable
                  responsable: "$$responsable",
                },
              },
            },
          },
        },
        {
          $group: {
            _id: {
              $first: "$data.responsable",
            },
            controlEmpleados: {
              $addToSet: "$data.controlEmpleados",
            },
            registrosProductoResultante: {
              $addToSet: "$data.registrosProductoResultante",
            },
          },
        },
        // PARA ELIMINAR ARRAY DENTRO DE ARRAY
        {
          $unwind: {
            path: "$controlEmpleados",
            includeArrayIndex: "arrayIndex", // optional
            preserveNullAndEmptyArrays: false, // optional
          },
        },
        {
          $unwind: {
            path: "$controlEmpleados",
            includeArrayIndex: "arrayIndex", // optional
            preserveNullAndEmptyArrays: false, // optional
          },
        },
        {
          $unwind: {
            path: "$controlEmpleados",
            includeArrayIndex: "arrayIndex", // optional
            preserveNullAndEmptyArrays: false, // optional
          },
        },
        {
          $unwind: {
            path: "$registrosProductoResultante",
            includeArrayIndex: "arrayIndex", // optional
            preserveNullAndEmptyArrays: false, // optional
          },
        },
        {
          $unwind: {
            path: "$registrosProductoResultante",
            includeArrayIndex: "arrayIndex", // optional
            preserveNullAndEmptyArrays: false, // optional
          },
        },
        {
          $unwind: {
            path: "$registrosProductoResultante",
            includeArrayIndex: "arrayIndex", // optional
            preserveNullAndEmptyArrays: false, // optional
          },
        },
        // AGRUPAR
        {
          $group: {
            _id: {
              _id: "$_id._id",
              nombre: "$_id.nombreEmpleado",
              active: "$_id.active",
            },
            controlEmpleados: {
              $addToSet: "$controlEmpleados",
            },
            registrosProductoResultante: {
              $addToSet: "$registrosProductoResultante",
            },
          },
        },
        {
          $match: {
            $expr: {
              $eq: ["$_id.active", true],
            },
          },
        },
      ]);
      // .explain("executionStats");
    } catch (error) {
      console.log(error);
    }
    return entities;
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
      entities = await strapi.query("producto-resultante").model.aggregate([
        ...dateBetweenPipe,
        { $match: { ok_start: true, ok_end: true } },
        {
          $group: {
            _id: {
              $toUpper: {
                $trim: {
                  input: "$nombre",
                },
              },
            },
            data: {
              $push: { nombre: "$nombre", fecha: "$createdAt" },
            },
            total: {
              $sum: 1,
            },
          },
        },
      ]);
    } catch (error) {
      console.log(error);
    }
    return entities;
  },

  async delete(ctx) {
    const { id } = ctx.params;
    let actividadUpdated = null;

    const entity = await strapi.services["producto-resultante"].delete({ id });
    console.log({ entity });
    let actividad = await strapi.services.actividad.findOne({
      id: entity.actividad.id,
    });
    try {
      // verificar si la actividad sigue teniendo productos resultantes
      actividad.existenProductoResultante = isNotEmpty(
        actividad.productosResultantes
      );
      let sumaTotalRequerido = 0;
      let sumaTotalConforme = 0;
      // actualizar porcentajes productos resultantes
      if (actividad.existenProductoResultante) {
        actividad.productosResultantes.map((producto) => {
          sumaTotalRequerido += producto.totalRequerido;
          producto.registrosProductoResultante.map((registro) => {
            sumaTotalConforme += registro.cantidadConforme;
          });
        });
        actividad.porcentajeProductoResultante = sumaTotalRequerido
          ? ((sumaTotalConforme * 100) / sumaTotalRequerido).toFixed(0)
          : 0;
      } else {
        actividad.porcentajeProductoResultante = 0;
      }

      // actualizar el estado "existenProductoResultante" de la actividad
      actividadUpdated = await strapi.services.actividad.update(
        { id: actividad.id },
        {
          existenProductoResultante: actividad.existenProductoResultante,
          porcentajeProductoResultante: actividad.porcentajeProductoResultante,
        }
      );
      console.log({ actividadUpdated });
    } catch (error) {
      console.log(error);
    }

    // true si el valor tiene elementos
    function isNotEmpty(value) {
      if (!value) return false;
      return value.length > 0;
    }

    return sanitizeEntity(actividadUpdated, {
      model: strapi.models["producto-resultante"],
    });
  },

  async update(ctx) {
    const { id } = ctx.params;

    let entity;
    if (ctx.is("multipart")) {
      const { data, files } = parseMultipartData(ctx);
      entity = await strapi.services["producto-resultante"].update(
        { id },
        data,
        {
          files,
        }
      );
    } else {
      entity = await strapi.services["producto-resultante"].update(
        { id },
        ctx.request.body,
        {
          path: "registrosProductoResultante",
          populate: { path: "responsable" },
        }
      );
    }

    return sanitizeEntity(entity, {
      model: strapi.models["producto-resultante"],
    });
  },
};
