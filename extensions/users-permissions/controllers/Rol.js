module.exports = {
  async create(ctx) {
    let role = ctx.request.body;
    try {
      const permissions = await strapi.plugins[
        "users-permissions"
      ].services.userspermissions.getActions();
      role.permissions = permisosNecesarios(permissions);
      role.users = [];
      return await strapi.plugins[
        "users-permissions"
      ].services.userspermissions.createRole(role);
    } catch (error) {
      console.log(error);
    }
  },
  async update(ctx) {
    try {
      let { id, type, name, description, permissions } = ctx.request.body;
      const permiso = await strapi
        .query("role", "users-permissions")
        .findOne({ id });
      if (typeof permissions === "undefined") {
        await strapi.plugins[
          "users-permissions"
        ].services.userspermissions.updateRole(permiso.id, {
          type,
          name,
          description,
        });
        return await strapi.query("role", "users-permissions").findOne({ id });
      } else {
        permissions = permisosNecesarios(permissions);
        await strapi.plugins[
          "users-permissions"
        ].services.userspermissions.updateRole(permiso.id, { permissions });
        return await strapi
          .query("role", "users-permissions")
          .findOne({ type });
      }
    } catch (error) {
      console.log(error);
    }
  },
  async getPermissionRole(ctx) {
    try {
      const { id } = ctx.params;
      const { controller } = ctx.request.body;
      return await strapi.query("role", "users-permissions").model.aggregate([
        { $match: { $expr: { $eq: ["$_id", { $toObjectId: id }] } } },
        {
          $lookup: {
            from: "users-permissions_permission",
            let: { id: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $in: ["$controller", controller] },
                      { $eq: ["$role", "$$id"] },
                    ],
                  },
                },
              },
            ],
            as: "controller",
          },
        },
        {
          $project: {
            ok: {
              $allElementsTrue: ["$controller.enabled"],
            },
          },
        },
      ]);
    } catch (error) {
      return error.message;
    }
  },
  async delete(ctx) {
    // Fetch public role.
    const publicRole = await strapi
      .query("role", "users-permissions")
      .findOne({ type: "public" });

    const publicRoleID = publicRole.id;

    const roleID = ctx.params.role;

    if (!roleID) {
      return ctx.badRequest(null, [{ messages: [{ id: "Bad request" }] }]);
    }

    // Prevent from removing the public role.
    if (roleID.toString() === publicRoleID.toString()) {
      return ctx.badRequest(null, [{ messages: [{ id: "Unauthorized" }] }]);
    }

    try {
      await strapi.plugins[
        "users-permissions"
      ].services.userspermissions.deleteRole(roleID, publicRoleID);

      ctx.send({ ok: true });
    } catch (err) {
      strapi.log.error(err);
      ctx.badRequest(null, [{ messages: [{ id: "Bad request" }] }]);
    }
  },
};

const permisosNecesarios = (permissions) => {
  const needed = ["find", "findOne"];
  for (let [key, value] of Object.entries(
    permissions.application.controllers
  )) {
    for (const metodo of needed) {
      if (value[metodo]) {
        permissions.application.controllers[key][metodo] = {
          enabled: true,
          policy: "",
        };
      }
    }
  }

  permissions["upload"].controllers.upload.find.enabled = true;
  permissions["upload"].controllers.upload.destroy.enabled = true;
  permissions["upload"].controllers.upload.findOne.enabled = true;
  permissions["upload"].controllers.upload.upload.enabled = true;
  permissions["users-permissions"].controllers.user.me.enabled = true;
  permissions[
    "users-permissions"
  ].controllers.rol.getPermissionRole.enabled = true;
  permissions[
    "users-permissions"
  ].controllers.userspermissions.getRole.enabled = true;
  permissions[
    "users-permissions"
  ].controllers.userspermissions.getPermissions.enabled = true;
  return permissions;
};
