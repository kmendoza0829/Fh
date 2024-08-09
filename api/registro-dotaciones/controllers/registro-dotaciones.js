"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const dateBetweenPipe = (start, end) => {
  return [
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
};
module.exports = {
  async findRegistros(ctx) {
    let dotaciones, dotacionesSeguridad, general;
    let { first, filtro, confirmado } = ctx.request.body;
    console.log({ first, filtro });
    try {
      dotaciones = await strapi.query("registro-dotaciones").model.aggregate([
        {
          $lookup: {
            from: "productos_dotaciones",
            localField: "productoDotaciones",
            foreignField: "_id",
            as: "productoDotaciones",
          },
        },
        { $unwind: "$productoDotaciones" },
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
            cantidadRequerida: "$cantidadRequerida",
            cantidadPendiente: "$cantidadPendiente",
            cantidadTotal: "$cantidadTotal",
            estado: "$estado",
            confirmado: "$confirmado",
            productoDotaciones: {
              _id: "$productoDotaciones._id",
              nombreProducto: "$productoDotaciones.nombreProducto",
              stockProducto: "$productoDotaciones.stockProducto"
            },
            empleado: {
              _id: "$empleado._id",
              nombre: "$empleado.nombreEmpleado",
            },
            createdAt: "$createdAt",
          },
        },
        {
          $match: {
            $expr: {
              $or: [
                {
                  $regexMatch: {
                    input: "$empleado.nombre",
                    regex: ".*" + filtro + ".*",
                    options: "i",
                  },
                },
                {
                  $regexMatch: {
                    input: "$productoDotaciones.nombreProducto",
                    regex: ".*" + filtro + ".*",
                    options: "i",
                  },
                },
                {
                  $regexMatch: {
                    input: "$estado",
                    regex: ".*" + filtro + ".*",
                    options: "i",
                  },
                },
              ],
            },
            confirmado,
          },
        },
      ]);
      dotacionesSeguridad = await strapi
        .query("registro-seguridad-dotaciones")
        .model.aggregate([
          {
            $lookup: {
              from: "seguridad_dotaciones",
              localField: "seguridadDotacion",
              foreignField: "_id",
              as: "seguridadDotacion",
            },
          },
          { $unwind: "$seguridadDotacion" },
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
              cantidadRequerida: "$cantidadRequerida",
              cantidadPendiente: "$cantidadPendiente",
              cantidadTotal: "$cantidadTotal",
              estado: "$estado",
              confirmado: "$confirmado",
              seguridadDotacion: {
                _id: "$seguridadDotacion._id",
                descripcion: "$seguridadDotacion.descripcion",
                stockProducto: "$seguridadDotacion.stockProducto"
              },
              empleado: {
                _id: "$empleado._id",
                nombre: "$empleado.nombreEmpleado",
              },
              createdAt: "$createdAt",
            },
          },
          {
            $match: {
              $expr: {
                $or: [
                  {
                    $regexMatch: {
                      input: "$empleado.nombre",
                      regex: ".*" + filtro + ".*",
                      options: "i",
                    },
                  },
                  {
                    $regexMatch: {
                      input: "$seguridadDotacion.descripcion",
                      regex: ".*" + filtro + ".*",
                      options: "i",
                    },
                  },
                  {
                    $regexMatch: {
                      input: "$estado",
                      regex: ".*" + filtro + ".*",
                      options: "i",
                    },
                  },
                ],
              },
              confirmado,
            },
          },
        ]);

      return {
        data: [...dotaciones, ...dotacionesSeguridad]
          .sort((a, b) => b?.createdAt - a?.createdAt)
          .slice(first, first + 10),
        count: [...dotaciones, ...dotacionesSeguridad]?.length,
      };
    } catch (err) {
      console.log(err);
      return;
    }
  },
  async findProductosByUser(ctx) {
    let dotaciones, dotacionesSeguridad, general;
    let { start, end } = ctx.request.body;

    try {
      dotaciones = await strapi.query("registro-dotaciones").model.aggregate([
        ...dateBetweenPipe(start, end),
        { $match: { ok_start: true, ok_end: true, confirmado: true } },
        {
          $lookup: {
            from: "productos_dotaciones",
            localField: "productoDotaciones",
            foreignField: "_id",
            as: "productoDotaciones",
          },
        },
        { $unwind: "$productoDotaciones" },
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
              _id: "$empleado._id",
              nombre: "$empleado.nombreEmpleado",
              active: "$empleado.active",
            },
            data: {
              $push: {
                _id: "$productoDotaciones._id",
                nombreProducto: "$productoDotaciones.nombreProducto",
                cantidadTotal: {
                  $sum: "$cantidadTotal",
                },
              },
            },
          },
        },
      ]);
      dotacionesSeguridad = await strapi
        .query("registro-seguridad-dotaciones")
        .model.aggregate([
          ...dateBetweenPipe(start, end),
          { $match: { ok_start: true, ok_end: true, confirmado: true } },
          {
            $lookup: {
              from: "seguridad_dotaciones",
              localField: "seguridadDotacion",
              foreignField: "_id",
              as: "seguridadDotacion",
            },
          },
          { $unwind: "$seguridadDotacion" },
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
                _id: "$empleado._id",
                nombre: "$empleado.nombreEmpleado",
                active: "$empleado.active",
              },
              data: {
                $push: {
                  _id: "$seguridadDotacion._id",
                  descripcion: "$seguridadDotacion.descripcion",
                  cantidadTotal: {
                    $sum: "$cantidadTotal",
                  },
                },
              },
            },
          },

        ]);
      console.log(dotaciones)
      const result = [...dotaciones.filter(d => d?._id?.active), ...dotacionesSeguridad.filter(d => d?._id?.active)].reduce(
        (prev, acc) => {
          const id = JSON.stringify(acc._id);
          prev[id] = prev[id] || [];
          prev[id].push(acc.data);
          prev[id] = prev[id].flatMap((d) => d);
          return prev;
        },
        Object.create(null)
      );

      return {
        data: result,
        count: Object.keys(result).length,
      };
    } catch (err) {
      console.log(err);
      return;
    }
  },
  async findDotacionesTotales(ctx) {
    let dotaciones, dotacionesSeguridad, general;
    let { start, end } = ctx.request.body;
    try {
      dotaciones = await strapi.query("registro-dotaciones").model.aggregate([
        ...dateBetweenPipe(start, end),
        { $match: { ok_start: true, ok_end: true, confirmado: true } },
        {
          $lookup: {
            from: "productos_dotaciones",
            localField: "productoDotaciones",
            foreignField: "_id",
            as: "productoDotaciones",
          },
        },
        { $unwind: "$productoDotaciones" },
        {
          $project: {
            _id: "$_id",
            producto: {
              _id: "$productoDotaciones._id",
              nombreProducto: "$productoDotaciones.nombreProducto",
            },
            cantidadTotal: "$cantidadTotal",
            createdAt: "$createdAt",
          },
        },
      ]);
      dotacionesSeguridad = await strapi
        .query("registro-seguridad-dotaciones")
        .model.aggregate([
          ...dateBetweenPipe(start, end),
          { $match: { ok_start: true, ok_end: true, confirmado: true } },
          {
            $lookup: {
              from: "seguridad_dotaciones",
              localField: "seguridadDotacion",
              foreignField: "_id",
              as: "seguridadDotacion",
            },
          },
          { $unwind: "$seguridadDotacion" },
          {
            $project: {
              _id: "$_id",
              producto: {
                _id: "$seguridadDotacion._id",
                descripcion: "$seguridadDotacion.descripcion",
              },
              cantidadTotal: "$cantidadTotal",
              createdAt: "$createdAt",
            },
          },
        ]);

      const result = [...dotaciones, ...dotacionesSeguridad];
      const unique = Array.from(
        new Set(result.map((d) => JSON.stringify(d.producto)))
      ).map((d) => JSON.parse(d));
      return {
        uniqueProducts: unique,
        data: result,
        count: result?.length,
      };
    } catch (err) {
      console.log(err);
      return;
    }
  },
  async findDotacionesAndSeguridadDotaciones(ctx) {
    let dotaciones, dotacionesSeguridad, general;
    try {
      dotaciones = await strapi.query("productos-dotaciones").model.aggregate([
        {
          $project: {
            _id: "$_id",
            nombreProducto: "$nombreProducto",
            stockProducto: "$stockProducto",
            empleado: {
              _id: "$empleado._id",
              nombre: "$empleado.nombreEmpleado",
            },
          },
        },
      ]);
      dotacionesSeguridad = await strapi
        .query("seguridad-dotaciones")
        .model.aggregate([
          {
            $project: {
              _id: "$_id",
              descripcion: "$descripcion",
              stockProducto: "$stockProducto",
            },
          },
        ]);

      return [...dotaciones, ...dotacionesSeguridad];
    } catch (err) {
      console.log(err);
      return;
    }
  },
  async assignDotacionesAndSeguridadDotaciones(ctx) {
    // return await strapi.services;
    let { dotaciones, empleados, cantidad } = ctx.request.body;
    if (dotaciones?.length <= 0 || empleados?.length <= 0 || cantidad <= 0)
      return new Error("datos invalidos");

    try {
      let peticiones = [];
      empleados.map((empleado) =>
        dotaciones.map(async (dotacion) => {
          const newCantidad = dotacion.stockProducto - cantidad;
          const pendiente = newCantidad <= 0;

          let name = dotacion?.descripcion
            ? "registro-seguridad-dotaciones"
            : "registro-dotaciones";
          let updateName = dotacion?.descripcion
            ? "seguridad-dotaciones"
            : "productos-dotaciones";
          let fieldName = dotacion?.descripcion
            ? "seguridadDotacion"
            : "productoDotaciones";
          const data = {
            cantidadRequerida: cantidad,
            cantidadPendiente: 0,
            cantidadTotal: cantidad,
            estado: "No Pendiente",
            confirmado: false,
            empleado: empleado._id,
            [fieldName]: dotacion._id,
          };

          if (pendiente) {
            data.cantidadPendiente = Math.abs(newCantidad);
            data.estado = "Pendiente";
            data.cantidadTotal = 0;
          }

          peticiones.push(
            new Promise(async (resolve, reject) => {
              if (data.estado !== "Pendiente") {
                await strapi.query(updateName).model.updateOne(
                  { _id: dotacion._id },
                  {
                    stockProducto: newCantidad,
                  }
                );
              } else {
                await strapi.query(updateName).model.updateOne(
                  { _id: dotacion._id },
                  {
                    stockProducto: 0,
                  }
                );
              }
              resolve(strapi.services[name].create(data));
            })
          );
        })
      );
      console.log(empleados.map((e) => e._id));

      return await Promise.all(peticiones);
    } catch (err) {
      console.log(err);
      return;
    }
  },
};
