const fs = require("fs");
const requestIp = require("request-ip");

const Cryptr = require("cryptr");
const cryptr = new Cryptr("myTotalySecretKey");

function getFecha() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0"); // January is 0!
  const yyyy = today.getFullYear();
  return dd + "-" + mm + "-" + yyyy;
}
function getHora() {
  const hora = new Date().getHours();
  const minutos = new Date().getMinutes();
  const segundos = new Date().getSeconds();
  const milisegundos = new Date().getMilliseconds();
  return hora + ":" + minutos + ":" + segundos + ":" + milisegundos;
}

function file(info, proceso, req) {
  if (proceso === "login") {
    console.log("Login Registrado");
    console.log(requestIp.getClientIp(req));
    const content =
      "Usuario: " +
      info +
      " - Fecha Ingreso: " +
      getFecha() +
      " - Hora Ingreso: " +
      getHora() +
      " - Direccion Ip: " +
      requestIp.getClientIp(req);

    writeFile(content);
  }
  //crud
  if (proceso === "crud") {
    console.log("Operacion Crud Registrada");
    const content = info;
    writeFile(content);
  }

  //loggout
  if (proceso === "logout") {
    console.log("Logout Registrado");
    const content = "\nHora de Salida: " + getHora() + "\n\n\n";
    writeFile(content);
  }
}

async function writeFile(content) {
  //const file = "/workspace/.tmp/logs/log-" + getFecha();
  const file = ".tmp/logs/log-" + getFecha();

  fs.appendFile(file, cryptr.encrypt(content) + "\n", function (err) {});
}

function decryptFile(fecha) {
  if (fecha > getFecha()) {
    return Promise.resolve("fecha invalida");
  }

  const file = ".tmp/logs/log-" + fecha;
  //const file = "/workspace/.tmp/logs/log-" + fecha;

  return new Promise((resolve, reject) => {
    fs.readFile(file, "utf8", function (err, data) {
      if (err) {
        resolve("El log no existe");
      } else {
        let textData = "";
        data = data.split(/\n/);
        data.map((res, index) => {
          res = res.replace(/^\s+|\s+$/g, "");
          const notSpaces = new RegExp(/^\S*$/);
          if (notSpaces.test(res) && res !== "") {
            textData = textData + cryptr.decrypt(res);
          }
        });
        resolve(textData);
      }
    });
  });
}

module.exports = {
  file,
  decryptFile,
};
