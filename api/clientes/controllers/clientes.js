const { sanitizeEntity } = require("strapi-utils");

module.exports = {
  /**
   * Retrieve records.
   *
   * @return {Array}
   */
  async create(ctx) {
    let entity;
      try {
        let { nit } =  ctx.request.body;
        let cliente = await strapi.services.clientes.findOne({
          nit: nit?.trim(),
        });
        if (cliente) {
          throw new Error("El nit ingresado ya existe");
        } else {
          entity = await strapi.services["clientes"].create(ctx.request.body);
        }
      } catch (error) {
        return ctx.badRequest('El nit ingresado ya existe', { foo: 'bar' })
      }
    return sanitizeEntity(entity, {
      model: strapi.models["clientes"],
    });
  },
  async find(ctx) {
    let entities;
    if (ctx.query._q) {
      entities = await strapi.services.clientes.search(ctx.query);
    } else {
      entities = await strapi.services.clientes.find(ctx.query);

      try {
        entities = await Promise.all(
          entities.map(async (entity) => {
            if (entity.pedidos.length) {
              entity.pedidos = await Promise.all(
                entity.pedidos.map(async (pedido) => {
                  const pedidoRes = await strapi.services.pedidos.findOne({
                    id: pedido.id,
                  });
                  return pedidoRes;
                })
              );
            }
            return entity;
          })
        );
      } catch (error) {
        console.log(error);
      }
    }

    return entities.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models.clientes })
    );
  },
  async list(ctx) {
    let entities = [];
    try {
      entities = await strapi.query("clientes").model.aggregate([
        // just let _id and nombreEmpresa
        {
          $project: {
            _id: "$_id",
            nombreEmpresa: "$nombreEmpresa",
            createdAt: "$createdAt",
          },
        },
      ]);
    } catch (error) {
      console.log(error);
    }
    return entities?.map((c) => ({
      id: c?._id,
      nombreEmpresa: c?.nombreEmpresa,
      createdAt: c?.createdAt,
    }));
  },
  async findwithoutpedidos(ctx) {
    let entities;
    if (ctx.query._q) {
      entities = await strapi.services.clientes.search(ctx.query);
    } else {
      entities = await strapi.services.clientes.find(ctx.query);
    }

    return entities.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models.clientes })
    );
  },
};
