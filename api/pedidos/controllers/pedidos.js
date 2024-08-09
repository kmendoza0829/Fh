const { parseMultipartData, sanitizeEntity } = require("strapi-utils");
const dayjs = require("dayjs");

module.exports = {
  async find(ctx) {
    let entities;
    if (ctx.query._q) {
      entities = await strapi.services.pedidos.search(ctx.query);
    } else {
      entities = await strapi.services.pedidos.find(ctx.query);

      try {
        //agrega tipo productos a los productos
        entities = await Promise.all(
          entities.map(async (entity) => {
            if (entity?.productos?.length) {
              entity.productos = await Promise.all(
                entity.productos.map(async (producto) => {
                  if (producto.esComercializable && producto?.tipo_producto) {
                    let tipoProducto = await strapi.services[
                      "tipo-productos"
                    ].findOne({
                      id: producto.tipo_producto,
                    });

                    if (tipoProducto) {
                      producto.tipo_producto = tipoProducto;
                    }
                  }
                  return producto;
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
      sanitizeEntity(entity, { model: strapi.models.pedidos })
    );
  },
  async listReporteGeneral(ctx) {
    let entities = [];
    // get params
    let { idCliente, fi, ff } = ctx.params;

    const mapResult = {};
    try {
      entities = await strapi.query("pedidos").find({ _limit: -1 });

      fi = dayjs(dayjs(fi).format("YYYY-MM-DD"));
      ff = dayjs(dayjs(ff).format("YYYY-MM-DD"));

      console.log({ first: entities[0] ?? null, length: entities.length });
      entities = entities.filter((entity) => {
        const fecha = dayjs(dayjs(entity.fecha).format("YYYY-MM-DD"));

        const isBetween =
          fecha.isSame(fi) ||
          fecha.isSame(ff) ||
          (fecha.isAfter(fi) && fecha.isBefore(ff));
        console.log({ fecha, isBetween });

        return (
          String(entity?.cliente?._id)?.trim() === String(idCliente)?.trim() &&
          isBetween
        );
      });

      const formatProductos = (productos) => {
        return productos.map((producto) => {
          return {
            _id: producto?._id,
            nombre: producto?.nombre,
            cantidad: producto?.cantidad,
            peso: producto?.peso,
            codigoProducto: producto?.codigoProducto,
            updatedAt: producto?.updatedAt,
          };
        });
      };

      // using an object, group by cliente.ciudad and concat all productos arrays
      entities.forEach((entity) => {
        const key = entity?.sitioEntrega?.trim()?.toUpperCase();
        const collection = mapResult[key];
        if (!collection) {
          mapResult[key] = [...formatProductos(entity?.productos)];
        } else {
          mapResult[key] = [
            ...mapResult[key],
            ...formatProductos(entity?.productos),
          ];
        }
      });
    } catch (error) {
      console.log({ error });
      return { error: error.message };
    }
    console.log("len: ", Object.keys(mapResult).length ?? 0);
    // reformat every field of mapResult into an object with property key and property value
    return Object.keys(mapResult).map((ciudad) => {
      const productos = mapResult[ciudad];
      return { ciudad, productos };
    });
  },
  async listReporteProductividadGeneral(ctx) {
    // get params
    let { fi, ff } = ctx.params;

    try {
      let productos = await strapi.query("pedidos").find({ _limit: -1 });
      let productividad = await strapi
        .query("control-empleados")
        .find({ _limit: -1 });

      fi = dayjs(dayjs(fi).format("YYYY-MM-DD"));
      ff = dayjs(dayjs(ff).format("YYYY-MM-DD"));

      const months = [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre",
      ];

      productos = productos.reduce((acc, ped) => {
        const finalizado = ped.estado == "listo_para_despacho";
        const fecha = dayjs(dayjs(ped.fecha).format("YYYY-MM-DD"));

        const isBetween =
          finalizado &&
          (fecha.isSame(fi) ||
            fecha.isSame(ff) ||
            (fecha.isAfter(fi) && fecha.isBefore(ff)));

        if (!isBetween) {
          return acc;
        }

        const init = {
          Enero: { productos: 0 },
          Febrero: { productos: 0 },
          Marzo: { productos: 0 },
          Abril: { productos: 0 },
          Mayo: { productos: 0 },
          Junio: { productos: 0 },
          Julio: { productos: 0 },
          Agosto: { productos: 0 },
          Septiembre: { productos: 0 },
          Octubre: { productos: 0 },
          Noviembre: { productos: 0 },
          Diciembre: { productos: 0 },
        };

        acc[fecha.year()] = acc[fecha.year()] || init;

        const sumKilos = ped?.productos?.reduce((accumulator, producto) => {
          const cantidad = producto.cantidad ?? 0,
            peso = producto.peso ?? 0;
          // FIXME: cantidad * peso if peso is not total
          return accumulator + peso;
        }, 0);

        acc[fecha.year()][months[fecha.month()]].productos =
          acc[fecha.year()][months[fecha.month()]].productos + sumKilos;

        return acc;
      }, {});

      productividad = productividad.reduce((acc, ce) => {
        const fechaInicio = dayjs(
          dayjs(`${ce.fechaIngreso} ${ce.horaIngreso}`).format(
            "YYYY-MM-DD HH:mm:ss"
          )
        );
        const fechaFin = dayjs(
          dayjs(`${ce.fechaSalida} ${ce.horaSalida}`).format(
            "YYYY-MM-DD HH:mm:ss"
          )
        );

        const inicioOk = fechaInicio.isSame(fi) || fechaInicio.isAfter(fi);
        const finOk = fechaFin.isSame(ff) || fechaFin.isBefore(ff);

        if (!inicioOk) {
          return acc;
        }

        let hoursBetween = fechaFin.diff(fechaInicio, "hours");

        if (inicioOk && !finOk) {
          hoursBetween = ff.diff(fechaInicio, "hours");
        }

        const init = {
          Enero: { productividad: 0 },
          Febrero: { productividad: 0 },
          Marzo: { productividad: 0 },
          Abril: { productividad: 0 },
          Mayo: { productividad: 0 },
          Junio: { productividad: 0 },
          Julio: { productividad: 0 },
          Agosto: { productividad: 0 },
          Septiembre: { productividad: 0 },
          Octubre: { productividad: 0 },
          Noviembre: { productividad: 0 },
          Diciembre: { productividad: 0 },
        };

        acc[fechaInicio.year()] = acc[fechaInicio.year()] || init;

        console.log({
          texto: fechaInicio.format("MM"),
          num: fechaInicio.month(),
          m: months[fechaInicio.month()],
        });
        acc[fechaInicio.year()][months[fechaInicio.month()]].productividad =
          acc[fechaInicio.year()][months[fechaInicio.month()]].productividad +
          hoursBetween;

        return acc;
      }, {});

      return mergeDeep(productos, productividad);
    } catch (error) {
      return { error: error.message };
    }
  },
  async validateNumeroPedido(ctx) {
    let entities = [],
      exists = false;
    try {
      let { numeroPedido } = ctx.params;
      numeroPedido = Number(numeroPedido) ?? 0;
      entities = await strapi.query("pedidos").model.aggregate([
        {
          $match: {
            $expr: {
              $and: [{ $eq: ["$numeroPedido", numeroPedido] }],
            },
          },
        },
        { $group: { _id: null, count: { $sum: 1 } } },
        { $project: { _id: 0 } },
      ]);
      exists = entities.length > 0;
    } catch (err) {
      console.log(err);
    }
    return exists;
  },
  async findpaginated(ctx) {
    let entities;
    const page = parseInt(ctx.query._start) || 0;
    const limit = parseInt(ctx.query._limit) || -1;
    const sort = ctx.query._sort || "_sort=createdAt:DESC";
    const globalFilter = ctx.query.globalFilter
      ? ctx.query.globalFilter.slice()
      : "";
    console.log("estado", ctx.query.estado, "prioridad", ctx.query.prioridad);
    const prioridad =
      ctx.query.prioridad !== undefined &&
      ctx.query.prioridad !== null &&
      ctx.query.prioridad !== ""
        ? ctx.query.prioridad
        : null;
    const estado =
      ctx.query.estado !== undefined &&
      ctx.query.estado !== null &&
      ctx.query.estado !== ""
        ? ctx.query.estado
        : null;
    delete ctx.query.globalFilter;
    delete ctx.query.prioridad;
    delete ctx.query.estado;

    const searchQuery = {
      ...ctx.query,
      _start: page,
      _limit: limit,
      _sort: sort,
    };

    console.log(searchQuery);

    try {
      const filters = [];

      if (globalFilter) {
        console.log({ globalFilter });
        filters.push({
          _or: [
            { numeroPedido: globalFilter },
            { ordenCliente: { $regex: new RegExp(globalFilter, "i") } },
            {
              "cliente.nombreEmpresa": {
                $regex: new RegExp(globalFilter, "i"),
              },
            },
          ],
        });
      }

      if (prioridad !== undefined && prioridad !== null && prioridad !== "") {
        filters.push({ prioridad: prioridad == "true" });
      }
      if (estado !== undefined && estado !== null && estado !== "") {
        filters.push({ estado: estado });
      }

      if (filters.length > 0) {
        searchQuery["_where"] = filters.reduce((accumulator, currentValue) => {
          return { ...accumulator, ...currentValue };
        });
      }

      console.log(JSON.stringify(searchQuery));
      entities = await strapi.services.pedidos.find(searchQuery);

      // Agrega tipo productos a los productos
      entities = await Promise.all(
        entities.map(async (entity) => {
          if (entity?.productos?.length) {
            entity.productos = await Promise.all(
              entity.productos.map(async (producto) => {
                if (producto.esComercializable && producto?.tipo_producto) {
                  let tipoProducto = await strapi.services[
                    "tipo-productos"
                  ].findOne({
                    id: producto.tipo_producto,
                  });

                  if (tipoProducto) {
                    producto.tipo_producto = tipoProducto;
                  }
                }
                return producto;
              })
            );
          }
          return entity;
        })
      );
    } catch (error) {
      console.error(error);
    }

    // Obtener el número total de pedidos con los mismos filtros
    const count = await strapi.services.pedidos.count(searchQuery);

    return {
      pedidos: entities.map((entity) =>
        sanitizeEntity(entity, { model: strapi.models.pedidos })
      ),
      count: count,
    };
  },
  async count(ctx) {
    const count = await strapi.services.pedidos.count(ctx.query);
    return { count };
  },
  async findOne(ctx) {
    const { id } = ctx.params;

    const entity = await strapi.services.pedidos.findOne({ id });

    try {
      if (entity.productos.length) {
        entity.productos = await Promise.all(
          await Promise.all(
            entity.productos.map(async (producto) => {
              producto = await strapi.services["pedido-productos"].findOne({
                id: producto.id,
              });

              producto.actividades = await Promise.all(
                producto.actividades.map(async (actividad) => {
                  //retornar actividades
                  let actividadRes = await strapi.services.actividad.findOne({
                    id: actividad,
                  });

                  //retornar piezas actividades
                  actividadRes.productosResultantes =
                    actividadRes.productosResultantes.map((resultante) => {
                      return {
                        ...resultante,
                        actividad: actividadRes.nombreActividad,
                      };
                    });

                  //retornar tipos materia prima d  entro de actividades -> materiasPrimasComponent
                  if (actividadRes.materiasPrimas.length) {
                    await Promise.all(
                      actividadRes.materiasPrimas.map(
                        async (materiasPrimas) => {
                          materiasPrimas.materiaPrima.tipoMateriaPrima =
                            await strapi.services[
                              "materias-primas-articulos-seleccionables"
                            ].findOne({
                              id: materiasPrimas.materiaPrima.tipoMateriaPrima,
                            });
                          return materiasPrimas;
                        }
                      )
                    );
                  }

                  return actividadRes;
                })
              );

              return producto;
            })
          )
        );
      }

      await Promise.all(
        entity.inspecProcesoGalvs.map(async (ipg, index) => {
          const i = await strapi.services["pedido-productos"].findOne({
            id: ipg.pedidoProducto,
          });
          entity.inspecProcesoGalvs[index].pedidoProducto = i;
        })
      );
      await Promise.all(
        entity.inspecProcesoPinturas.map(async (ipp, index) => {
          const i = await strapi.services["pedido-productos"].findOne({
            id: ipp.pedidoProducto,
          });
          entity.inspecProcesoPinturas[index].pedidoProducto = i;
        })
      );
    } catch (error) {
      console.log(error);
    }
    return sanitizeEntity(entity, { model: strapi.models.pedidos });
  },
  async update(ctx) {
    const { id } = ctx.params;

    let entity;
    if (ctx.is("multipart")) {
      const { data, files } = parseMultipartData(ctx);
      entity = await strapi.services.pedidos.update({ id }, data, {
        files,
      });
    } else {
      entity = await strapi.services.pedidos.update({ id }, ctx.request.body);
      try {
        if (entity.productos.length) {
          entity.productos = await Promise.all(
            await Promise.all(
              entity.productos.map(async (producto) => {
                if (producto.actividades) {
                  producto.actividades = await Promise.all(
                    producto.actividades.map(async (actividad) => {
                      const actividadRes =
                        await strapi.services.actividad.findOne({
                          id: actividad,
                        });
                      return actividadRes;
                    })
                  );
                }

                return producto;
              })
            )
          );
        }

        await Promise.all(
          entity.inspecProcesoGalvs.map(async (ipg, index) => {
            const i = await strapi.services["pedido-productos"].findOne({
              id: ipg.pedidoProducto,
            });
            entity.inspecProcesoGalvs[index].pedidoProducto = i;
          })
        );
        await Promise.all(
          entity.inspecProcesoPinturas.map(async (ipg, index) => {
            const i = await strapi.services["pedido-productos"].findOne({
              id: ipg.pedidoProducto,
            });
            entity.inspecProcesoPinturas[index].pedidoProducto = i;
          })
        );
      } catch (error) {
        console.log(error);
      }
    }

    return sanitizeEntity(entity, { model: strapi.models.pedidos });
  },
  async create(ctx) {
    let entity;
    if (ctx.is("multipart")) {
      const { data, files } = parseMultipartData(ctx);
      entity = await strapi.services.pedidos.create(data, { files });
    } else {
      entity = await strapi.services.pedidos.create(ctx.request.body);
      try {
        await Promise.all(
          entity.inspecProcesoGalvs.map(async (ipg, index) => {
            const i = await strapi.services["pedido-productos"].findOne({
              id: ipg.pedidoProducto,
            });
            entity.inspecProcesoGalvs[index].pedidoProducto = i;
          })
        );
        await Promise.all(
          entity.inspecProcesoPinturas.map(async (ipg, index) => {
            const i = await strapi.services["pedido-productos"].findOne({
              id: ipg.pedidoProducto,
            });
            entity.inspecProcesoPinturas[index].pedidoProducto = i;
          })
        );
      } catch (error) {
        console.log(error);
      }
    }
    return sanitizeEntity(entity, { model: strapi.models.pedidos });
  },
  async delete(ctx) {
    const { id } = ctx.params;

    let entity = await strapi.services.pedidos.findOne({ id });

    try {
      //eliminar productos
      if (entity.productos.length) {
        //obtener actividades productos
        entity.productos = await Promise.all(
          await Promise.all(
            entity.productos.map(async (producto) => {
              producto = await strapi.services["pedido-productos"].findOne({
                id: producto.id,
              });

              producto.actividades = await Promise.all(
                producto.actividades.map(async (actividad) => {
                  const actividadRes = await strapi.services.actividad.findOne({
                    id: actividad,
                  });
                  return actividadRes;
                })
              );

              return producto;
            })
          )
        );

        await Promise.all(
          entity.productos.map(async (producto) => {
            if (producto.actividades.length) {
              //eliminar los productos resultantes de las actividades
              await Promise.all(
                producto.actividades.map(async (actividad) => {
                  if (actividad.productosResultantes.length) {
                    //eliminar registros producto resultante
                    await Promise.all(
                      actividad.productosResultantes.map(async (resultante) => {
                        await strapi.services["producto-resultante"].update(
                          { id: resultante.id },
                          {
                            registrosProductoResultante: [],
                          }
                        );
                      })
                    );

                    await deleteObjectsCollection(
                      actividad.productosResultantes,
                      "producto-resultante"
                    );
                  }

                  //eliminar las materias primas
                  if (actividad.materiasPrimas.length) {
                    await strapi.services.actividad.update(
                      { id: actividad.id },
                      {
                        materiasPrimas: [],
                      }
                    );
                  }
                })
              );

              await Promise.all(
                producto.actividades.map(async (actividad) => {
                  console.log(actividad.actividadPiezasSobrantes);
                  const eliminado = await deleteObjectsCollection(
                    [actividad.actividadPiezasSobrantes],
                    "actividad-piezas-sobrantes"
                  );
                  console.log({ eliminado });
                })
              );

              //eliminar las actividades
              await deleteObjectsCollection(producto.actividades, "actividad");
            }

            if (producto.despachos.length) {
              //eliminar pedidos despacho
              await Promise.all(
                producto.despachos.map(async (despacho) => {
                  if (despacho.pedido_despacho) {
                    await deleteObjectsCollection(
                      [despacho.pedido_despacho],
                      "pedido-despachos"
                    );
                  }
                })
              );

              //eliminar despachos del producto
              await deleteObjectsCollection(
                producto.despachos,
                "pedidos-productos-despachos"
              );
            }

            //eliminar registros de pendientes
            if (producto.productos_pendiente) {
              await deleteObjectsCollection(
                [producto.productos_pendiente],
                "productos-pendientes"
              );
            }
          })
        );

        // eliminar productos
        await deleteObjectsCollection(entity.productos, "pedido-productos");
      }

      //eliminar inspecciones
      if (entity.pedidoInspecciones.length) {
        entity.pedidoInspecciones.map((inspeccion) => {
          if (inspeccion.archivos) {
            deleteFiles(inspeccion.archivos);
          }
        });
      }
      await deleteObjectsCollection(
        entity.pedidoInspecciones,
        "pedido-inspecciones"
      );

      if (entity.inspecProcesoGalvs.length) {
        await Promise.all(
          entity.inspecProcesoGalvs.map(async (inspec) => {
            await strapi.services["inspec-proceso-galv"].update(
              { id: inspec.id },
              {
                espesorRecubrimiento: null,
              }
            );
          })
        );

        await deleteObjectsCollection(
          entity.inspecProcesoGalvs,
          "inspec-proceso-galv"
        );
      }

      if (entity.inspecProcesoPinturas.length) {
        await Promise.all(
          entity.inspecProcesoPinturas.map(async (inspec) => {
            await strapi.services["inspec-proceso-pintura"].update(
              { id: inspec.id },
              {
                espesorRecubrimiento: null,
              }
            );
          })
        );

        await deleteObjectsCollection(
          entity.inspecProcesoPinturas,
          "inspec-proceso-pintura"
        );
      }

      if (entity?.ensambles.length) {
        entity.ensambles = await Promise.all(
          await Promise.all(
            entity.ensambles.map(async (ensamble) => {
              ensamblePedido = await strapi.services["ensamble"].findOne({
                id: ensamble.id,
              });

              // eliminar ensambles piezas
              if (ensamblePedido?.piezas?.length) {
                await Promise.all(
                  ensamblePedido.piezas.map(async (pieza) => {
                    ensamblePieza = await strapi.services[
                      "ensamble-piezas"
                    ].findOne({
                      id: pieza.id,
                    });

                    if (ensamblePieza?.id) {
                      await deleteObjectsCollection(
                        [ensamblePieza],
                        "ensamble-piezas"
                      );
                    }
                  })
                );
              }
              if (ensamblePedido) {
                return ensamblePedido;
              }
              return ensamble;
            })
          )
        );

        await Promise.all(
          entity.ensambles.map(async (ensamble) => {
            if (ensamble?.id) {
              await deleteObjectsCollection([ensamble], "ensamble");
            }
          })
        );
      }

      if (entity.inspecSoldadura.archivos.length) {
        deleteFiles(entity.inspecSoldadura.archivos);
      }

      if (entity.inspecSoldadura.informeEnsayo.length) {
        entity.inspecSoldadura.informeEnsayo =
          entity.inspecSoldadura.informeEnsayo.map((informe) => {
            if (informe.data) {
              informe.data = [];
            }
            return null;
          });
        entity.inspecSoldadura.informeEnsayo =
          entity.inspecSoldadura.informeEnsayo.filter((e) => e != null);

        //actualizar el informe elimina la data del tipo de junta seccion

        await strapi.services["inspec-soldadura"].update(
          { id: entity.inspecSoldadura.id },
          {
            informeEnsayo: entity.inspecSoldadura.informeEnsayo,
          }
        );

        // actualizar el informe ensayo elimina el informe ensayo de mongo
        entity.inspecSoldadura.informeEnsayo = [];

        await strapi.services["inspec-soldadura"].update(
          { id: entity.inspecSoldadura.id },
          {
            informeEnsayo: entity.inspecSoldadura.informeEnsayo,
          }
        );
      }

      await deleteObjectsCollection(
        [entity.inspecSoldadura],
        "inspec-soldadura"
      );

      if (entity.inspecLiquidosPenetrantes.archivos.length) {
        deleteFiles(entity.inspecLiquidosPenetrantes.archivos);
      }
      await deleteObjectsCollection(
        [entity.inspecLiquidosPenetrantes],
        "inspec-liquidos-penetrantes"
      );

      // actualizar contratos (al remover el pedido se necesitan recalcular los contratos en los que estaba asociado)

      if (entity.contrato) {
        entity.contrato = await strapi.services[
          "consolidado-contratos"
        ].findOne({
          id: entity.contrato.id,
        });

        let sumaValor = 0;
        entity.contrato.pedidos.map((pedido) => {
          if (pedido.valor && pedido.id != entity.id) {
            sumaValor += +pedido.valor;
          }
        });

        let saldo = entity.contrato.valorContrato - sumaValor;
        const porcentajeSaldo = (saldo * 100) / entity.contrato.valorContrato;

        const nuevo = await strapi.services["consolidado-contratos"].update(
          {
            id: entity.contrato.id,
          },
          {
            saldo,
            porcentajeSaldo,
          }
        );
      }

      await strapi.services.pedidos.update(
        { id: entity.id },
        {
          porcentajesActividades: null,
        }
      );

      //eliminar pedido
      entity = await strapi.services.pedidos.delete({ id: entity.id });
    } catch (error) {
      console.log(error);
    }

    async function deleteObjectsCollection(objects, collection) {
      if (objects.length) {
        let invalid = false;
        // si es un array de null retorna null, si no , elimina los objetos
        const objectsArray = objects.map((object) => {
          if (object === null) {
            invalid = true;
            return null;
          }
          return object._id ? object._id : null;
        });

        if (invalid) {
          return null;
        }

        return strapi
          .query(collection)
          .model.deleteMany({ _id: { $in: objectsArray } });
      }
    }

    async function deleteFiles(archivos) {
      await Promise.all(
        archivos.map(async (archivo) => {
          const file = await strapi.plugins["upload"].services.upload.fetch({
            id: archivo.id,
          });
          await strapi.plugins["upload"].services.upload.remove(file);
        })
      );
    }

    return sanitizeEntity(entity, { model: strapi.models.pedidos });
  },
};

function isObject(item) {
  return item && typeof item === "object" && !Array.isArray(item);
}

function mergeDeep(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}
