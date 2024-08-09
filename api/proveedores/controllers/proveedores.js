"use strict";

const { sanitizeEntity } = require("strapi-utils");

const utils = require("../../../utils/logs");

module.exports = {
  /**
   * Retrieve records.
   *
   * @return {Array}
   */

  async find(ctx) {
    let entities;
    if (ctx.query._q) {
      entities = await strapi.services.proveedores.search(ctx.query);
    } else {
      entities = await strapi.services.proveedores.find(ctx.query);
    }
    utils.file("\nGet Proveedores", "crud", null);
    return entities.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models.proveedores })
    );
  },
  async findOne(ctx) {
    const { id } = ctx.params;

    utils.file("\nGet Proveedor - id: " + id, "crud", null);
    const entity = await strapi.services.proveedores.findOne({ id });
    return sanitizeEntity(entity, { model: strapi.models.proveedores });
  },
  async create(ctx) {
    let entity;
    if (ctx.is("multipart")) {
      const { data, files } = parseMultipartData(ctx);
      entity = await strapi.services.proveedores.create(data, { files });
    } else {
      entity = await strapi.services.proveedores.create(ctx.request.body);
    }

    utils.file("\nCreate Proveedor - id: " + entity.id, "crud", null);

    return sanitizeEntity(entity, { model: strapi.models.proveedores });
  },
  async update(ctx) {
    const { id } = ctx.params;

    const proveedor = await strapi.services.proveedores.findOne({ id });

    utils.file(
      "\nUpdate Proveedor - before: " + JSON.stringify(proveedor),
      "crud"
    );

    let entity;
    if (ctx.is("multipart")) {
      const { data, files } = parseMultipartData(ctx);
      entity = await strapi.services.proveedores.update({ id }, data, {
        files,
      });
    } else {
      entity = await strapi.services.proveedores.update(
        { id },
        ctx.request.body
      );
    }
    utils.file(
      "\nUpdate Proveedor - after: " + JSON.stringify(entity),
      "crud",
      null
    );

    return sanitizeEntity(entity, { model: strapi.models.proveedores });
  },
  async delete(ctx) {
    const { id } = ctx.params;

    const entity = await strapi.services.proveedores.delete({ id });

    utils.file("\nDelete Proveedor: " + JSON.stringify(entity), "crud", null);
    return sanitizeEntity(entity, { model: strapi.models.proveedores });
  },
};
