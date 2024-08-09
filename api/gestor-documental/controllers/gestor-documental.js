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
      entities = await strapi.services["gestor-documental"].search(ctx.query);
    } else {
      entities = await strapi.services["gestor-documental"].find(ctx.query);
    }

    try {
      Promise.all(
        entities.map(async (entity) => {
          return await Promise.all(
            entity.items.map(async (item, index) => {
              if (item.archivo) {
                let archivo = await strapi
                  .query("item-gestor-documental.gestor-documental")
                  .findOne({
                    id: item.archivo.id,
                  });
                entity.items[index].archivo = archivo;
              }
              return entity.items[index];
            })
          );
        })
      );

      // entities = Promise.all(
      //   entities.map(async (entity) => {
      //     return getSubCarpetas(entity);
      //   })
      // );

      console.log(entities);
    } catch (error) {
      console.log(error);
    }

    // function getSubCarpetas(carpeta) {
    //   if (carpeta?.subCarpetas?.length) {
    //     carpeta = Promise.all(
    //       carpeta.subCarpetas.map(async (subCarpeta) => {
    //         let carpeta_completa = await strapi
    //           .query("gestor-documental")
    //           .findOne({
    //             id: subCarpeta.id,
    //           });
    //         if (carpeta_completa?.subCarpeta) {
    //           return getSubCarpetas(carpeta_completa);
    //         }
    //         return carpeta_completa;
    //       })
    //     );
    //     return carpeta;
    //   }
    //   return carpeta;
    // }

    return entities.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models["gestor-documental"] })
    );
  },

  async delete(ctx) {
    const { id } = ctx.params;

    const entity = await strapi.services["gestor-documental"].delete({ id });
    return sanitizeEntity(entity, {
      model: strapi.models["gestor-documental"],
    });
  },
};
