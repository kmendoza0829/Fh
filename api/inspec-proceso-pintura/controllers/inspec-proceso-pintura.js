const { parseMultipartData, sanitizeEntity } = require("strapi-utils");

module.exports = {
  /**
   * Create a record.
   *
   * @return {Object}
   */

  async create(ctx) {
    let entity;
    if (ctx.is("multipart")) {
      const { data, files } = parseMultipartData(ctx);
      entity = await strapi.services["inspec-proceso-pintura"].create(data, {
        files,
      });
    } else {
      entity = await strapi.services["inspec-proceso-pintura"].create(
        ctx.request.body
      );
      try {
        entity.pedido = await strapi.services.pedidos.update(
          {
            id: entity.pedido.id,
          },
          {
            inspecProcesoPinturas: [
              ...entity.pedido.inspecProcesoPinturas,
              entity.id,
            ],
          }
        );
      } catch (error) {
        console.log(error);
      }
    }
    return sanitizeEntity(entity, {
      model: strapi.models["inspec-proceso-pintura"],
    });
  },
  async update(ctx) {
    const { id } = ctx.params;

    let entity;
    if (ctx.is("multipart")) {
      const { data, files } = parseMultipartData(ctx);
      entity = await strapi.services["inspec-proceso-pintura"].update(
        { id },
        data,
        {
          files,
        }
      );
    } else {
      entity = await strapi.services["inspec-proceso-pintura"].update(
        { id },
        ctx.request.body
      );
      try {
        let pedido = await strapi.services.pedidos.findOne({
          id: entity.pedido,
        });
        entity.pedido = pedido;
      } catch (error) {
        console.log(error);
      }
    }

    return sanitizeEntity(entity, {
      model: strapi.models["inspec-proceso-pintura"],
    });
  },
};
