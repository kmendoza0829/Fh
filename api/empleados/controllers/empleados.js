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
      entities = await strapi.services.empleados.search(ctx.query);
    } else {
      entities = await strapi.services.empleados.find(ctx.query, [
        {
          path: "registroDotaciones",
          populate: { path: "productoDotaciones" },
        },
        {
          path: "registroSDotaciones",
          populate: { path: "seguridadDotacion" },
        },
        { path: "controlEmpleados" },
      ]);
    }

    // try {
    //   await Promise.all(
    //     entities.map(async (empleado, i) => {
    //       await Promise.all(
    //         empleado.registroDotaciones.map(async (rd, j) => {
    //           const pd = await strapi.services["productos-dotaciones"].findOne({
    //             id: rd.productoDotaciones,
    //           });
    //           entities[i].registroDotaciones[j].productoDotaciones = pd;
    //         })
    //       );
    //       await Promise.all(
    //         empleado.registroSDotaciones.map(async (rs, j) => {
    //           const sd = await strapi.services["seguridad-dotaciones"].findOne({
    //             id: rs.seguridadDotacion,
    //           });
    //           entities[i].registroSDotaciones[j].seguridadDotacion = sd;
    //         })
    //       );
    //       return entities[i];
    //     })
    //   );
    // } catch (error) {
    //   console.log(error);
    // }
    return entities.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models.empleados })
    );
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const generatePipeline = (args) => ({
      let: { idEmp: "$_id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $eq: ["$empleado", "$$idEmp"],
            },
          },
        },
        ...args,
      ],
    });
    const entity = await strapi.query("empleados").model.aggregate([
      {
        $match: {
          $expr: { $eq: ["$_id", { $toObjectId: id }] },
        },
      },
      { $limit: 1 },
      {
        $lookup: {
          from: "registro_dotaciones",
          ...generatePipeline([
            {
              $lookup: {
                from: "productos_dotaciones",
                localField: "productoDotaciones",
                foreignField: "_id",
                as: "productoDotaciones",
              },
            },
            { $unwind: "$productoDotaciones" },
          ]),
          as: "registroDotaciones",
        },
      },
      {
        $lookup: {
          from: "registro_seguridad_dotaciones",
          ...generatePipeline([
            {
              $lookup: {
                from: "seguridad_dotaciones",
                localField: "seguridadDotacion",
                foreignField: "_id",
                as: "seguridadDotacion",
              },
            },
            { $unwind: "$seguridadDotacion" },
          ]),
          as: "registroSDotaciones",
        },
      },
      {
        $lookup: {
          from: "control_empleados",
          ...generatePipeline([]),
          as: "controlEmpleados",
        },
      },
    ]);
    // findOne({ id }, [
    //   { path: "registroDotaciones", populate: { path: "productoDotaciones" } },
    //   { path: "registroSDotaciones", populate: { path: "seguridadDotacion" } },
    //   { path: "controlEmpleados" },
    // ]);
    return entity.length ? entity[0] : null;
  },

  async update(ctx) {
    const { id } = ctx.params;

    let entity;
    if (ctx.is("multipart")) {
      const { data, files } = parseMultipartData(ctx);
      entity = await strapi.services.empleados.update({ id }, data, {
        files,
      });
    } else {
      entity = await strapi.services.empleados.update({ id }, ctx.request.body);
      try {
        await Promise.all(
          entity.registroSDotaciones.map(async (rs, j) => {
            const sd = await strapi.services["seguridad-dotaciones"].findOne({
              id: rs.seguridadDotacion,
            });
            entity.registroSDotaciones[j].seguridadDotacion = sd;
          })
        );
        await Promise.all(
          entity.registroDotaciones.map(async (rd, j) => {
            const pd = await strapi.services["productos-dotaciones"].findOne({
              id: rd.productoDotaciones,
            });
            entity.registroDotaciones[j].productoDotaciones = pd;
          })
        );
      } catch (error) {
        console.log(error);
      }
    }

    return sanitizeEntity(entity, { model: strapi.models.empleados });
  },
  async updateConfirmacionDotaciones(ctx) {
    const { id } = ctx.params;
    const { dotacionesConfirmadas } = ctx.request.body;
    try {
      let empleado = await strapi.services.empleados.findOne({ id });
      if (dotacionesConfirmadas) {
        const registroDotaciones = empleado.registroDotaciones.map(
          (rd) => rd.id
        );
        const registroSDotaciones = empleado.registroSDotaciones.map(
          (rsd) => rsd.id
        );

        const genQuery = (input) => {
          return {
            $match: {
              $expr: {
                $in: [
                  "$_id",
                  {
                    $map: {
                      input,
                      as: "rd",
                      in: { $toObjectId: "$$rd" },
                    },
                  },
                ],
              },
              confirmado: false,
            },
          };
        };
        const dotacionesNoConfirmadas = (
          await strapi
            .query("registro-dotaciones")
            .model.aggregate([genQuery(registroDotaciones)])
        ).map((dt) => dt?._id);
        const dotacionesSNoConfirmadas = (
          await strapi
            .query("registro-dotaciones")
            .model.aggregate([genQuery(registroSDotaciones)])
        ).map((dst) => dst?._id);

        let operacionesRegistroDotaciones = [];
        let operacionesRegistroSDotaciones = [];
        const updater = (viejo, noConfirmadas, nuevo) => {
          viejo.forEach((registro) => {
            if (registro in noConfirmadas) {
              nuevo.push({
                updateOne: {
                  filter: { _id: registro },
                  update: { confirmado: true },
                },
              });
            }
          });
        };
        updater(
          registroDotaciones,
          dotacionesNoConfirmadas,
          operacionesRegistroDotaciones
        );
        updater(
          registroSDotaciones,
          dotacionesSNoConfirmadas,
          operacionesRegistroSDotaciones
        );
        await strapi
          .query("registro-dotaciones")
          .model.bulkWrite(operacionesRegistroDotaciones);
        await strapi
          .query("registro-seguridad-dotaciones")
          .model.bulkWrite(operacionesRegistroSDotaciones);
      }
      await strapi.services.empleados.update({ id }, { dotacionesConfirmadas });
      return await strapi.query("empleados").findOne({ id }, [
        {
          path: "registroDotaciones",
          populate: { path: "productoDotaciones" },
        },
        {
          path: "registroSDotaciones",
          populate: { path: "seguridadDotacion" },
        },
      ]);
    } catch (error) {
      console.log(error);
    }
  },
  async generarpdfs(ctx) {
    let entity;

    try {
      var axios = require("axios");
      let { data, dpmm, width, height } = ctx.request.body;

      var config = {
        method: "post",
        url: `http://api.labelary.com/v1/printers/${dpmm}/labels/${width}x${height}/`,
        headers: {
          Accept: "application/pdf",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        responseType: "arraybuffer",
        data: data,
      };

      await axios(config)
        .then(function (response) {
          entity = response.data;
        })
        .catch(function (error) {
          entity = error;
        });
    } catch (error) {
      console.log("ha ocurrido un error ", error);
    }

    return sanitizeEntity(entity, { model: strapi.models.empleados });
  },
};
