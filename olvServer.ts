
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
  console.log(`GET request from ${req.query.From}`);
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
      sendWelcomeMessage(cliente);
      sesionCliente.flujo.paso = "eligiendo_servicio";
      break;
    case "eligiendo_servicio":
      handleServiceSelection(cliente, incomingMessage);
      sesionCliente.flujo.paso = mapServices(incomingMessage);
      break;
    case "cotizar":
      handleQuotation(cliente, incomingMessage, sesionCliente.flujo);
      break;
    default:
      sendErrorMessage(cliente);
      break;
  }

  res.status(200).send("Message processed");
});

// Conversation Steps

function sendWelcomeMessage(sender: string) {
  const welcomeMessage = `¡Hola! 😊 ¿Cómo puedo ayudarte hoy? Por favor elige una de las siguientes opciones:
1. *Comprar* - Comprar una guía.
2. *Cotizar* - Cotizar una guía.
3. *Soporte* - Contactar a soporte.`;

  sendMessage(sender, welcomeMessage, "Mensaje de bienvenida enviado");
}

function handleServiceSelection(sender: string, choice: string) {
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

  sendMessage(sender, responseMessage, "Respuesta enviada");
}

function handleQuotation(sender: string, message: string, flujo: Flujo) {
  console.log(`Iniciando cotización para el sender: ${sender}`);

  if (!flujo.subpaso) {
    flujo.subpaso = "creando_remitente";
  }
  console.log(`Current subpaso: ${flujo.subpaso}`);

  switch (flujo.subpaso) {
    case "creando_remitente":
      createSender(sender, message);
      flujo.subpaso = "creando_destinatario";
      break;
    case "creando_destinatario":
      createRecipient(sender, message);
      flujo.subpaso = "creando_paquetes";
      break;
    case "creando_paquetes":
      createPackages(sender, message);
      calculateCosts(sender);
      flujo.paso = "bienvenida";
      flujo.subpaso = "";
      break;
    default:
      sendErrorMessage(sender);
      break;
  }
}

// Helper function to clean state names
function cleanStateName(state: string): string {
  return state
    .split(" ")
    .join("_")
    .toLowerCase()
    .replace(/á/g, "a")
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9_]/g, "");
}

function createSender(sender: string, message: string) {
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
    emulatePostDb("remitente", remitente, "create");

    sendMessage(
      sender,
      `Por favor, ingresa los datos del destinatario separados por comas en el siguiente orden:
        Nombre, Calle, Código Postal, colonia, Ciudad, Estado`,
      "Datos del remitente confirmados"
    );
  } else {
    sendMessage(
      sender,
      `Los datos del remitente no están en el formato correcto. Por favor, ingresa los datos nuevamente siguiendo el orden indicado:
        Nombre, Calle, Código Postal, colonia, Ciudad, Estado`,
      "Error en formato de datos del remitente"
    );
  }
}

function createRecipient(sender: string, message: string) {
  const datos = message.split(",").map((dato) => dato.trim());
  if (datos.length != 6) {
    sendMessage(
      sender,
      `Los datos del destinatario no están en el formato correcto. Por favor, ingresa los datos nuevamente siguiendo el orden indicado:
        Nombre, Calle, Código Postal, colonia, Ciudad, Estado`,
      "Error en formato de datos del destinatario"
    );
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
    emulatePostDb("destinatario", destinatario, "create");

    sendMessage(
      sender,
      `Ahora proporciona la siguiente información de tus paquetes en el siguiente orden.
        Alto, ancho, largo, peso.
        Los datos deben incluir sus unidades cm y kg.
        Para darte una cotización adecuada por favor proporciona las dimensiones y peso exactos.
        De lo contrario solo podemos proporcionar una aproximación del costo y éste puede ser actualizado cuando visites la sucursal.
        Si es más de un paquete, separa cada paquete con un punto y coma ";"
        EJEMPLO Dos paquetes:
        10cm, 15cm, 15cm, 0.5kg;
        6.2cm, 12cm, 18.5cm, 5.3kg`,
      "Datos del destinatario confirmados"
    );
  }
}

function createPackages(sender: string, message: string) {
  const sesionCliente = sesionesDeUsuario[sender];

  const paquetes = message.includes(";")
    ? message.split(";").map((dato) => dato.trim())
    : [message.trim()];

  console.log("Paquetes recibidos:", paquetes);

  let paquetesValidos = true;

  for (const paquete of paquetes) {
    if (!validatePackageFormat(paquete)) {
      paquetesValidos = false;
      break;
    }
  }

  if (paquetesValidos) {
    savePackagesInSession(paquetes, sesionCliente);
  } else {
    requestPackageResubmission(sender);
  }
}

function savePackagesInSession(paquetes: string[], sesionCliente: UserSession) {
  for (const paquete of paquetes) {
    emulatePostDb(
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

function requestPackageResubmission(sender: string) {
  sendMessage(
    sender,
    `Por favor, verifica el formato de los paquetes y envíalos nuevamente.\n
      Ejemplo de formato:\n
      10cm, 15cm, 15cm, 0.5kg\n
      6.2cm, 12cm, 18.5cm, 5.3kg`,
    "Error en formato de paquetes"
  );
}

function calculateCosts(sender: string) {
  const sesionCliente = sesionesDeUsuario[sender];
  if (!sesionCliente.paquetes) {
    console.log("No hay paquetes en la sesión");
    sendErrorMessage(sender);
    return;
  }

  const paquetes = sesionCliente.paquetes;
  const remitente = sesionCliente.remitente;
  const destinatario = sesionCliente.destinatario;

  const estado_remitente = cleanStateName(`${remitente?.estado}`);
  const estado_destinatario = cleanStateName(`${destinatario?.estado}`);

  console.log("Estado del remitente:", estado_remitente);
  console.log("Estado del destinatario:", estado_destinatario);

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
  console.log("Grupo del remitente:", groupRemitente);
  console.log("Grupo del destinatario:", groupDestinatario);

  let ZonaEnvio: string | undefined =
    ZonasDeEnvio[groupRemitente]?.[groupDestinatario];

  if (groupRemitente === groupDestinatario) {
    console.log(
      "Esta  tarifa no aplica para todas las ciudades, quieres ser redirigido para atencion?"
    );
    //FLUJO POR REALIZAR
    ZonaEnvio = ZonaEnvio?.replace("*", "");
  }

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

  sendMessage(sender, mensaje_costo, "Mensaje de costo enviado");
}

// Helper functions
function sendErrorMessage(sender: string) {
  console.error(`Enviando mensaje de error al sender: ${sender}`);
  sendMessage(
    sender,
    "Oops! Algo salió mal. Por favor intenta mas tarde.",
    "Mensaje de error enviado"
  );
}

function emulatePostDb(entityName: string, entityData: any, action: string) {
  console.log(
    "emulando accion",
    action,
    "en",
    entityName,
    "con datos",
    entityData
  );
  const filePath = path.join(__dirname, "../db", `${entityName}.csv`);
  const data = Object.values(entityData).join(",") + "\n";

  fs.appendFile(filePath, data, (err) => {
    if (err) {
      console.error(`Error guardando los datos en ${entityName}.csv:`, err);
    } else {
      console.log(`Datos guardados en ${entityName}.csv`);
    }
  });
}

function validatePackageFormat(paquete: string) {
  const datos = paquete.split(",").map((dato) => dato.replace(",", "").trim());
  return datos.length === 4;
}

function mapServices(choice: string) {
  switch (choice) {
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

function sendMessage(to: string, body: string, logMessage: string) {
  client.messages
    .create({
      body,
      from: sandboxNumber,
      to,
    })
    .then((message) => {
      console.log(`${logMessage}: ${message.sid}`);
    })
    .catch((err) => {
      console.error(`Error enviando mensaje: ${err}`);
    });
}
