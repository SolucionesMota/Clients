import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { client, sandboxNumber } from "../config/twilio-config";
import {
  TarifaNacional_10_30,
  TarifaNacional_8_30,
  TarifaNacional_Dia_Siguiente,
  TarifaNacional_Economico,
  ZonasDeEnvio,
  ZonasZipCodeMap,
} from "../db/ZonasZipCode";
import { Paquete, Person, ZipCodeRange } from "./types/types";

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

interface Flujo {
  paso: string;
  subpaso?: string;
}
interface UserSession {
  flujo: Flujo;
  destinatario?: Person;
  remitente?: Person;
  paquetes?: Paquete[];
}

const sesionesDeUsuario: { [key: string]: UserSession } = {};

app.get("/", (req: Request, res: Response) => {
  console.log(`get request from ${req.query.From}`);
  res.send("Hello World");
});

app.post("/chatbot", (req: Request, res: Response) => {
  const incomingMessage = req.body.Body;
  const cliente = req.body.From;

  console.log(`Mensaje recibido de ${cliente}: ${incomingMessage}`);

  if (!sesionesDeUsuario[cliente]) {
    sesionesDeUsuario[cliente] = { flujo: { paso: "bienvenida" } };
  }

  const sesionCliente = sesionesDeUsuario[cliente];

  switch (sesionCliente.flujo.paso) {
    case "bienvenida":
      bienvenida(cliente);
      sesionCliente.flujo.paso = "eligiendo_servicio";
      break;
    case "eligiendo_servicio":
      eligiendo_servicio(cliente, incomingMessage);
      sesionCliente.flujo.paso = map_services(incomingMessage);
      break;
    case "cotizar":
      cotizar(cliente, incomingMessage, sesionCliente.flujo);
      break;
    default:
      sendErrorMessage(cliente);
      break;
  }

  res.status(200).send("Message processed");
});

//Pasos de la conversación

function bienvenida(sender: string) {
  const mensajeBienvenida = `¡Hola! 😊 ¿Cómo puedo ayudarte hoy? Por favor elige una de las siguientes opciones:
1. *Comprar* - Comprar una guía.
2. *Cotizar* - Cotizar una guía.
3. *Soporte* -   Contactar a soporte.`;

  client.messages
    .create({
      body: mensajeBienvenida,
      from: sandboxNumber,
      to: sender,
    })
    .then((message) => {
      console.log(`Mensaje de bienvenida enviado: ${message.sid}`);
      console.log(`Mensaje enviado: ${mensajeBienvenida}`);
    })
    .catch((err) =>
      console.error("Error enviando mensaje de bienvenida:", err)
    );
}

function eligiendo_servicio(sender: string, choice: string) {
  let responseMessage = "";

  switch (choice.toLowerCase()) {
    case "1":
    case "comprar":
      responseMessage =
        "Great! Let's get started with your purchase. What would you like to buy?";
      break;
    case "2":
    case "cotizar":
      responseMessage = `Para cotizar necesitamos más detalles. Por favor, ingresa los datos del remitente separados por una coma en el siguiente orden:
      Nombre, Calle, Código Postal, colonia, Ciudad, Estado.`;
      break;
    case "3":
    case "soporte":
      responseMessage =
        "Sure! How can we assist you? Please describe your issue.";
      break;

    default:
      responseMessage =
        "Sorry, I didn't understand that. Please choose one of the following options:\n1. Comprar\n2. Cotizar\n3. Soporte";
      break;
  }

  client.messages
    .create({
      body: responseMessage,
      from: sandboxNumber,
      to: sender,
    })
    .then((message) => {
      console.log(`Respuesta enviada: ${message.sid}`);
      console.log(`Mensaje enviado: ${responseMessage}`);
    })
    .catch((err) => console.error("Error al enviar respuesta:", err));
}

function cotizar(sender: string, message: string, flujo: Flujo) {
  console.log(`Iniciando cotización para el sender: ${sender}`);

  if (!flujo.subpaso) {
    flujo.subpaso = "creando_remitente";
  }
  console.log(`Current subpaso: ${flujo.subpaso}`);

  switch (flujo.subpaso) {
    case "creando_remitente":
      crear_remitente(sender, message);
      flujo.subpaso = "creando_destinatario";
      break;
    case "creando_destinatario":
      crear_destinatario(sender, message);
      flujo.subpaso = "creando_paquetes";
      break;
    case "creando_paquetes":
      crear_paquetes(sender, message);
      calcular_costos(sender);
      flujo.paso = "bienvenida";
      flujo.subpaso = "";
      break;
    // case "calculando_costos":
    //   // calcular_costos(sender);
    //   break;
    //   console.log("Calling calcular_costos function");
    //   calcular_costos(sender);
    //   break;
    default:
      sendErrorMessage(sender);
      break;
  }
}

// Función auxiliar para limpiar el nombre del estado
function limpiarEstado(estado: string): string {
  return estado
    .split(" ")
    .join("_")
    .toLowerCase() // Convertir a minúsculas
    .replace(/á/g, "a") // Remover acentos
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9_]/g, ""); // Remover caracteres especiales
}

function crear_remitente(sender: string, message: string) {
  const datos = message.split(",").map((dato) => dato.trim());

  if (datos.length === 6) {
    const [nombre, calle, codigoPostal, colonia, ciudad, estado] = datos;
    const remitente: Person = {
      nombre,
      calle,
      codigoPostal,
      colonia,
      ciudad,
      estado,
    };
    sesionesDeUsuario[sender].remitente = remitente;

    console.log("Datos del remitente recibidos:", remitente);
    emular_post_db_general("remitente", remitente, "create");

    client.messages
      .create({
        body: `Por favor, ingresa los datos del destinatario separados por comas en el siguiente orden:
        Nombre, Calle, Código Postal, colonia, Ciudad, Estado`,
        from: sandboxNumber,
        to: sender,
      })
      .then((message) => {
        console.log(`Datos recibidos: ${message.sid}`);
        console.log(
          `Mensaje enviado: Por favor, ingresa los datos del destinatario separados por comas en el siguiente orden: Nombre, Calle, Código Postal, colonia, Ciudad, Estado`
        );
      })
      .catch((err) => console.error("Error enviando confirmación:", err));
  } else {
    const errorMessage = `Los datos del remitente no están en el formato correcto. Por favor, ingresa los datos nuevamente siguiendo el orden indicado:
        Nombre, Calle, Código Postal, colonia, Ciudad, Estado`;
    client.messages
      .create({
        body: errorMessage,
        from: sandboxNumber,
        to: sender,
      })
      .then((message) =>
        console.log(`Solicitando datos nuevamente: ${message.sid}`)
      )
      .catch((err) =>
        console.error("Error solicitando datos nuevamente:", err)
      );
  }
}

function crear_destinatario(sender: string, message: string) {
  const datos = message.split(",").map((dato) => dato.trim());
  if (datos.length != 6) {
    const errorMessage = `Los datos del destinatario no están en el formato correcto. Por favor, ingresa los datos nuevamente siguiendo el orden indicado:
        Nombre, Calle, Código Postal, colonia, Ciudad, Estado`;
    client.messages.create({
      body: errorMessage,
      from: sandboxNumber,
      to: sender,
    });
  } else {
    const [nombre, calle, codigoPostal, colonia, ciudad, estado] = datos;
    const destinatario: Person = {
      nombre,
      calle,
      codigoPostal,
      colonia,
      ciudad,
      estado,
    };
    sesionesDeUsuario[sender].destinatario = destinatario;

    console.log("Datos del destinatario recibidos:", destinatario);
    emular_post_db_general("destinatario", destinatario, "create");

    client.messages
      .create({
        body: `Ahora proporciona la siguiente información de tus paquetes en el siguiente orden.
        Alto, ancho, largo, peso.
        Los datos deben incluir sus unidades cm y kg.
        Para darte una cotización adecuada por favor proporciona las dimensiones y peso exactos.
        De lo contrario solo podemos proporcionar una aproximación del costo y éste puede ser actualizado cuando visites la sucursal.
        Si es más de un paquete, separa cada paquete con un punto y coma ";"
        EJEMPLO Dos paquetes:
        10cm, 15cm, 15cm, 0.5kg;
        6.2cm, 12cm, 18.5cm, 5.3kg`,
        from: sandboxNumber,
        to: sender,
      })
      .then((message) => {
        console.log(`Confirmación enviada: ${message.sid}`);
        console.log(
          `Mensaje enviado: Ahora proporciona la siguiente información de tus paquetes en el siguiente orden. Alto, ancho, largo, peso. Los datos deben incluir sus unidades cm y kg. Para darte una cotización adecuada por favor proporciona las dimensiones y peso exactos. De lo contrario solo podemos proporcionar una aproximación del costo y éste puede ser actualizado cuando visites la sucursal. Si es más de un paquete, separa cada paquete con un punto y coma ";". EJEMPLO Dos paquetes: 10cm, 15cm, 15cm, 0.5kg; 6.2cm, 12cm, 18.5cm, 5.3kg`
        );
      })
      .catch((err) => console.error("Error enviando confirmación:", err));
  }
}

function crear_paquetes(sender: string, message: string) {
  const sesionCliente = sesionesDeUsuario[sender];

  // Verificar si el mensaje contiene múltiples paquetes
  const paquetes = message.includes(";")
    ? message.split(";").map((dato) => dato.trim())
    : [message.trim()]; // Si no hay ";", se asume un solo paquete

  console.log("Paquetes recibidos:", paquetes);

  let paquetesValidos = true;

  // Validar cada paquete
  for (const paquete of paquetes) {
    if (!validar_formato_paquete(paquete)) {
      paquetesValidos = false;
      break;
    }
  }

  if (paquetesValidos) {
    guardarPaquetesEnSesion(paquetes, sesionCliente);
    // enviarConfirmacionPaquetes(paquetes, sender);
  } else {
    solicitarReenvioPaquetes(sender);
  }
}

function guardarPaquetesEnSesion(
  paquetes: string[],
  sesionCliente: UserSession
) {
  for (const paquete of paquetes) {
    emular_post_db_general(
      "paquetes",
      {
        remitente: JSON.stringify(sesionCliente.remitente),
        paquete,
      },
      "create"
    );
  }
  sesionCliente.paquetes = paquetes.map((paquete) => {
    const [alto, ancho, largo, peso] = paquete
      .split(",")
      .map((dato) =>
        parseFloat(dato.replace("cm", "").replace("kg", "").trim())
      );

    return { alto, ancho, largo, peso } as Paquete;
  });
}

function enviarConfirmacionPaquetes(paquetes: string[], sender: string) {
  client.messages
    .create({
      body: `Hemos recibido los siguientes paquetes: ${JSON.stringify(
        paquetes
      )}\n. En un momento te proporcionaremos el costo de envío.`,
      from: sandboxNumber,
      to: sender,
    })
    .then((message) => {
      console.log(`Mensaje de costo enviado: ${message.sid}`);
      console.log(
        `Mensaje enviado: Hemos recibido los siguientes paquetes: ${JSON.stringify(
          paquetes
        )}\n. En un momento te proporcionaremos el costo de envío.`
      );
    })
    // .then((message) => {
    // console.log(`Calculando costo de envio: ${message.sid}`);
    // Avanzar al siguiente subpaso
    // sesionesDeUsuario[sender].flujo.subpaso = "creando_destinatario";
    // })
    .catch((err) => {
      console.error("Error solicitando datos del destinatario:", err);
    });
}

function solicitarReenvioPaquetes(sender: string) {
  client.messages
    .create({
      body: `Por favor, verifica el formato de los paquetes y envíalos nuevamente.\n
      Ejemplo de formato:\n
      10cm, 15cm, 15cm, 0.5kg\n
      6.2cm, 12cm, 18.5cm, 5.3kg`,
      from: sandboxNumber,
      to: sender,
    })
    .then((message) => {
      console.log(`Solicitando datos nuevamente: ${message.sid}`);
    })
    .catch((err) => {
      console.error("Error solicitando datos nuevamente:", err);
    });
}

function calcular_costos(sender: string) {
  const sesionCliente = sesionesDeUsuario[sender];
  if (!sesionCliente.paquetes) {
    console.log("No hay paquetes en la sesión");
    sendErrorMessage(sender);
    return;
  }

  const paquetes = sesionCliente.paquetes;
  const remitente = sesionCliente.remitente;
  const destinatario = sesionCliente.destinatario;

  const estado_remitente = limpiarEstado(`${remitente?.estado}`);
  const estado_destinatario = limpiarEstado(`${destinatario?.estado}`);

  const ZonaZipCodeRemitente: ZipCodeRange[] | undefined = ZonasZipCodeMap.get(
    `${estado_remitente}`
  )?.filter(
    (zona) =>
      Number(zona.zipcode_start) <= Number(`${remitente?.codigoPostal}`) &&
      Number(zona.zipcode_end) >= Number(`${remitente?.codigoPostal}`)
  );

  const ZonaZipCodeDestinatario: ZipCodeRange[] | undefined =
    ZonasZipCodeMap.get(`${estado_destinatario}`)?.filter(
      (zona) =>
        Number(zona.zipcode_start) <= Number(`${destinatario?.codigoPostal}`) &&
        Number(zona.zipcode_end) >= Number(`${destinatario?.codigoPostal}`)
    );

  if (!ZonaZipCodeRemitente || !ZonaZipCodeDestinatario) {
    sendErrorMessage(sender);
    return;
  }

  const groupRemitente: string = ZonaZipCodeRemitente[0].group;
  const groupDestinatario: string = ZonaZipCodeDestinatario[0].group;

  const ZonaEnvio: string | undefined =
    ZonasDeEnvio[groupRemitente]?.[groupDestinatario];

  if (!ZonaEnvio) {
    sendErrorMessage(sender);
    return;
  }

  let mensaje_costo = `Los paquetes tienen un costo de envío de:\n`;

  for (let paquete of paquetes) {
    const peso = Math.ceil(paquete.peso);
    const costo_fedex_8_30 =
      TarifaNacional_8_30.Paquetes[peso][Number(ZonaEnvio)];
    const costo_fedex_10_30 =
      TarifaNacional_10_30.Paquetes[peso][Number(ZonaEnvio)];
    const costo_fedex_economico =
      TarifaNacional_Economico.Paquetes[peso][Number(ZonaEnvio)];
    const costo_fedex_dia_siguiente =
      TarifaNacional_Dia_Siguiente.Paquetes[peso][Number(ZonaEnvio)];

    mensaje_costo += `Paquete ${JSON.stringify(paquete)}: \n`;
    mensaje_costo += `- Fedex 8:30: ${costo_fedex_8_30}\n`;
    mensaje_costo += `- Fedex 10:30: ${costo_fedex_10_30}\n`;
    mensaje_costo += `- Fedex económico: ${costo_fedex_economico}\n`;
    mensaje_costo += `- Fedex día siguiente: ${costo_fedex_dia_siguiente}\n`;
  }

  client.messages
    .create({
      body: mensaje_costo,
      from: sandboxNumber,
      to: sender,
    })
    .then((message) => {
      console.log(`Mensaje de costo enviado: ${message.sid}`);
      console.log(`Mensaje de costo enviado: ${message.body}`);
    })
    .catch((err) => {
      console.error("Error enviando mensaje de costo:", err);
    });
}

// Funciones auxiliares
function sendErrorMessage(sender: string) {
  console.error(`Enviando mensaje de error al sender: ${sender}`);
  client.messages
    .create({
      body: "Oops! Algo salió mal. Por favor intenta mas tarde.",
      from: sandboxNumber,
      to: sender,
    })
    .then((message) => {
      console.log(`Mensaje de error enviado: ${message.sid}`);
    })
    .catch((err) => {
      console.error("Error enviando mensaje de error:", err);
      console.error(`Detalles del error: ${JSON.stringify(err)}`);
    });
}

function emular_post_db_general(
  some_entity_name: string,
  some_entity_data: any,
  action: string
) {
  console.log(
    "emulando accion",
    action,
    "en",
    some_entity_name,
    "con datos",
    some_entity_data
  );
  // New code to save data into a CSV file
  const filePath = path.join(__dirname, "../db", `${some_entity_name}.csv`);
  const data = Object.values(some_entity_data).join(",") + "\n"; // Convert object values to CSV format

  fs.appendFile(filePath, data, (err) => {
    if (err) {
      console.error(
        `Error guardando los datos en ${some_entity_name}.csv:`,
        err
      );
    } else {
      console.log(`Datos guardados en ${some_entity_name}.csv`);
    }
  });
}

function validar_formato_paquete(paquete: string) {
  const datos = paquete.split(",").map((dato) => dato.replace(",", "").trim());
  return datos.length === 4;
}

function map_services(choise: string) {
  switch (choise) {
    case "1":
    case "comprar":
      return "comprar";
    case "2":
    case "cotizar":
      return "cotizar";
    case "3":
    case "soporte":
      return "soporte";
    default:
      return "error";
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
