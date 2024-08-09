const { parseMultipartData, sanitizeEntity } = require("strapi-utils");

module.exports = {
  /**
   * Update a record.
   *
   * @return {Object}
   */

  async update(ctx) {
    const { id } = ctx.params;

    let entity;
    if (ctx.is("multipart")) {
      const { data, files } = parseMultipartData(ctx);
      entity = await strapi.services["registro-seguridad-dotaciones"].update(
        { id },
        data,
        {
          files,
        }
      );
    } else {
      entity = await strapi.services["registro-seguridad-dotaciones"].update(
        { id },
        ctx.request.body
      );
      try {
        const seguridadDotacion = await strapi.services[
          "seguridad-dotaciones"
        ].findOne({ id: entity.seguridadDotacion.id });
        if (seguridadDotacion) {
          entity.seguridadDotacion = seguridadDotacion;
        }
      } catch (error) {
        console.log(error);
      }
    }

    return sanitizeEntity(entity, {
      model: strapi.models["registro-seguridad-dotaciones"],
    });
  },
};
