const { parseMultipartData, sanitizeEntity } = require("strapi-utils");

module.exports = {
    async delete(ctx) {
        const { id } = ctx.params;
        try {
          const ensambleProductoPendiente = await strapi.services["productos-pendientes"].delete({ ensamble_pieza: id });
          if (!ensambleProductoPendiente) {
            throw new Error("Ensamble pendiente no encontrado");
          }
          const ensamble = await strapi.services["ensamble-piezas"].delete({ id });
          
          if (!ensamble) {
            throw new Error("Ensamble no encontrado");
          }
          return sanitizeEntity(ensamble, { model: strapi.models["ensamble-piezas"] });
        } catch (error) {
          console.log(error);
        }
      },
};
