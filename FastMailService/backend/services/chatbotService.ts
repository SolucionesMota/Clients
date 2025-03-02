import fs from "fs";
import path from "path";
import { client, sandboxNumber } from "../config/twilio-config";
import { TarifaNacional_8_30, ZonasZipCodeMap } from "../db/ZonasZipCode";
import {
  Cliente,
  Envio,
  Flujo,
  Paquete,
  UserSession,
  ZipCodeRange,
} from "../types/types";

const chatbotSesionesDeUsuario: { [key: string]: UserSession } = {};

export function processChatbotMessageLogic(
  cliente: string,
  incomingMessage: string
) {
  if (!chatbotSesionesDeUsuario[cliente]) {
    chatbotSesionesDeUsuario[cliente] = { flujo: { paso: "bienvenida" } };
  }
  if (!chatbotSesionesDeUsuario[cliente].ultimo_envio) {
    chatbotSesionesDeUsuario[cliente].ultimo_envio = {} as Envio;
  }

  const sesionCliente = chatbotSesionesDeUsuario[cliente];

  switch (sesionCliente.flujo.paso) {
    case "bienvenida":
      handleBienvenida(cliente);
      sesionCliente.flujo.paso = "eligiendo_servicio";
      break;
    case "eligiendo_servicio":
      handleEligiendoServicio(cliente, incomingMessage);
      sesionCliente.flujo.paso = "cotizar";
      break;
    case "cotizar":
      handleCotizar(cliente, incomingMessage, sesionCliente.flujo);
      // sesionCliente.flujo.paso = "confirmar_envio";
      break;
    default:
      sendMessage(cliente, "No entiendo tu mensaje", "Mensaje no entendido");
      break;
  }
}

//Pasos de la conversación principal

function handleBienvenida(sender: string) {
  const mensajeBienvenida = `¡Hola! 😊 ¿Cómo puedo ayudarte hoy? Por favor elige una de las siguientes opciones:
1. *Comprar* - Comprar una guía.
2. *Cotizar* - Cotizar una guía.
3. *Soporte* -   Contactar a soporte.`;

  sendMessage(sender, mensajeBienvenida, "Mensaje de bienvenida enviado");
}

function handleEligiendoServicio(sender: string, choice: string) {
  const responseMessage = getServiceResponseMessage(choice);
  sendMessage(sender, responseMessage, "Respuesta enviada");
}

function handleCotizar(sender: string, message: string, flujo: Flujo) {
  console.log(`Iniciando cotización`);

  if (!flujo.subpaso) {
    flujo.subpaso = "creando_remitente";
  }

  console.log(`Flujo actual: ${flujo.subpaso}\n`);
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
      console.log("Paquetes creados");
      calcular_costos(sender);
      console.log("Costos calculados");
      crear_envio(sender, message);
      console.log("Envio creado");
      flujo.subpaso = "calculando_costos";
      return;
    // case "calculando_costos":
    //   calcular_costos(sender);
    //   flujo.subpaso = "creando_envio";
    //   return;
    // case "creando_envio":
    //   crear_envio(sender, message);
    //   flujo.subpaso = "eligiendo_tarifa";
    //   break;
    // case "eligiendo_tarifa":
    //   // elegir_tarifa(sender, message);
    //   flujo.subpaso = "confirmar_envio";
    //   break;
    // case "confirmar_envio":
    //   crear_envio(sender, message);
    //   break;
    default:
      sendMessage(
        sender,
        "Lo siento, no entiendo tu mensaje. Por favor intenta de nuevo.",
        "Mensaje no entendido"
      );
      break;
  }
}

//Sub pasos cotizar

function getServiceResponseMessage(choice: string): string {
  switch (choice.toLowerCase()) {
    case "1":
    case "comprar":
      return "Great! Let's get started with your purchase. What would you like to buy?";
    case "2":
    case "cotizar":
      return `Para cotizar necesitamos más detalles. Por favor, ingresa los datos del remitente separados por una coma en el siguiente orden:
    Nombre, Calle, Código Postal, colonia, Ciudad, Estado.`;
    case "3":
    case "soporte":
      return "Sure! How can we assist you? Please describe your issue.";
    default:
      return "Sorry, I didn't understand that. Please choose one of the following options:\n1. Comprar\n2. Cotizar\n3. Soporte";
  }
}

function sendMessage(sender: string, body: string, logMessage: string) {
  client.messages
    .create({
      body,
      from: sandboxNumber,
      to: sender,
    })
    .then((message) => {
      console.log(`${logMessage}: ${message.sid}`);
      console.log(`Mensaje enviado: ${body}`);
    })
    .catch((err) => console.error(`Error enviando mensaje: ${err}`));
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
    const remitente: Cliente = {
      nombre,
      calle,
      codigoPostal,
      colonia,
      ciudad,
      estado,
      celular: sender.split(":")[1],
    };
    chatbotSesionesDeUsuario[sender].remitente = remitente;

    console.log("Datos del remitente recibidos:", remitente);
    emular_post("remitente", remitente);

    sendMessage(
      sender,
      "Por favor, ingresa los datos del destinatario separados por comas en el siguiente orden: Nombre, Calle, Código Postal, colonia, Ciudad, Estado",
      "Solicitando datos del destinatario"
    );
  } else {
    const errorMessage = `Los datos del remitente no están en el formato correcto. Por favor, ingresa los datos nuevamente siguiendo el orden indicado:
      Nombre, Calle, Código Postal, colonia, Ciudad, Estado`;
    sendMessage(sender, errorMessage, "Error al solicitar datos del remitente");
  }
}

function crear_destinatario(sender: string, message: string) {
  const datos = message.split(",").map((dato) => dato.trim());
  if (datos.length != 6) {
    const errorMessage = `Los datos del destinatario no están en el formato correcto. Por favor, ingresa los datos nuevamente siguiendo el orden indicado:
      Nombre, Calle, Código Postal, colonia, Ciudad, Estado`;
    sendMessage(
      sender,
      errorMessage,
      "Error al solicitar datos del destinatario"
    );
  } else {
    const [nombre, calle, codigoPostal, colonia, ciudad, estado] = datos;
    const destinatario: Cliente = {
      nombre,
      calle,
      codigoPostal,
      colonia,
      ciudad,
      estado,
      celular: sender.split(":")[1],
    };
    chatbotSesionesDeUsuario[sender].destinatario = destinatario;

    console.log("Datos del destinatario recibidos:", destinatario);
    emular_post("destinatario", destinatario);

    sendMessage(
      sender,
      'Ahora proporciona la siguiente información de tus paquetes en el siguiente orden. Alto, ancho, largo, peso. Los datos deben incluir sus unidades cm y kg. Para darte una cotización adecuada por favor proporciona las dimensiones y peso exactos. De lo contrario solo podemos proporcionar una aproximación del costo y éste puede ser actualizado cuando visites la sucursal. Si es más de un paquete, separa cada paquete con un punto y coma ";". EJEMPLO Dos paquetes: 10cm, 15cm, 15cm, 0.5kg; 6.2cm, 12cm, 18.5cm, 5.3kg',
      "Solicitando información de paquetes"
    );
  }
}

function crear_paquetes(sender: string, message: string) {
  const sesionCliente = chatbotSesionesDeUsuario[sender];

  // Verificar si el mensaje contiene múltiples paquetes
  const paquetes = message.includes(";")
    ? message.split(";").map((dato) => dato.trim())
    : [message.trim()]; // Si no hay ";", se asume un solo paquete

  console.log("Paquetes recibidos:", paquetes);
  // if (paquetesValidos) {
  guardarPaquetesEnSesion(paquetes, sesionCliente);
  // const tarifas = obtenerTarifas(paquetes);
  // enviarConfirmacionPaquetes(paquetes, sender);
  // enviarConfirmacionPaquetes(paquetes, sender);
  // } else {

  // solicitarReenvioPaquetes(sender);
  // }
}

function crear_envio(sender: string, message: string) {
  const sesionCliente = chatbotSesionesDeUsuario[sender];
  const envios: Envio[] = [];
  const paquetes: Paquete[] | undefined = sesionCliente.paquetes;
  const remitente = sesionCliente?.remitente;
  const destinatario = sesionCliente?.destinatario;

  if (!paquetes) {
    console.log("No hay paquetes en la sesión");
    sendMessage(
      sender,
      "No hay paquetes en la sesión",
      "No hay paquetes en la sesión"
    );
    return;
  }
  if (!remitente) {
    console.log("No hay remitente en la sesión");
    sendMessage(
      sender,
      "No hay remitente en la sesión",
      "No hay remitente en la sesión"
    );
    return;
  }
  if (!destinatario) {
    console.log("No hay destinatario en la sesión");
    sendMessage(
      sender,
      "No hay destinatario en la sesión",
      "No hay destinatario en la sesión"
    );
    return;
  }

  // for (const paquete of paquetes) {
  let envio: Envio = {} as Envio;
  envio.remitente = remitente;
  envio.destinatario = destinatario;
  envio.paquetes = paquetes;
  envio.tarifa = TarifaNacional_8_30;
  envio.fechaEnvio = new Date();
  envio.fechaEntrega = new Date();
  envio.estado = "prospecto";
  envio._id = "1";
  console.log("Envio creado:", envio);
  emular_post("envios", envio);
  sesionCliente.ultimo_envio = envio;
  envios.push(envio);
  sesionCliente.envios = envios;
  // }

  // Convertir los envíos a JSON para imprimirlos de manera legible
}

function guardarPaquetesEnSesion(
  paquetes: string[],
  sesionCliente: UserSession
) {
  // for (const paquete of paquetes) {
  //   emular_post_db_general(
  //     "paquetes",
  //     {
  //       // remitente: JSON.stringify(sesionCliente.remitente),
  //       paquete,
  //     },
  //     "create"
  //   );
  // }
  sesionCliente.paquetes = paquetes.map((paquete) => {
    const [alto, ancho, largo, peso] = paquete
      .split(",")
      .map((dato) =>
        parseFloat(dato.replace("cm", "").replace("kg", "").trim())
      );

    return { alto, ancho, largo, peso } as Paquete;
  });
}

function calcular_costos(sender: string) {
  const sesionCliente = chatbotSesionesDeUsuario[sender];
  if (!sesionCliente.paquetes) {
    console.log("No hay paquetes en la sesión");
    sendMessage(
      sender,
      "No hay paquetes en la sesión",
      "No hay paquetes en la sesión"
    );
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

  console.log("ZonaZipCodeRemitente:", ZonaZipCodeRemitente);
  console.log("ZonaZipCodeDestinatario:", ZonaZipCodeDestinatario);
}

function obtenerTarifas(paquetes: string[]) {
  const tarifas = [];
  for (const paquete of paquetes) {
    const [alto, ancho, largo, peso] = paquete
      .split(",")
      .map((dato) =>
        parseFloat(dato.replace("cm", "").replace("kg", "").trim())
      );
  }
}

//Mensajes
function enviarConfirmacionPaquetes(paquetes: string[], sender: string) {
  sendMessage(
    sender,
    `Hemos recibido los siguientes paquetes: ${JSON.stringify(
      paquetes
    )}\n. Estos son las tarifas dispónibles para el envío. Por favor elige la que mas te convenga`,
    "Confirmación de paquetes enviados"
  );
}

function solicitarReenvioPaquetes(sender: string) {
  sendMessage(
    sender,
    `Por favor, verifica el formato de los paquetes y envíalos nuevamente.\n
    Ejemplo de formato:\n
    10cm, 15cm, 15cm, 0.5kg\n
    6.2cm, 12cm, 18.5cm, 5.3kg`,
    "Solicitando reenvío de paquetes"
  );
}

function emular_post(nombreObjeto: string, datos: any) {
  const filePath = path.join(__dirname, `${nombreObjeto}.csv`);
  const csvData = Object.values(datos).join(",") + "\n";

  fs.appendFile(filePath, csvData, (err) => {
    if (err) {
      console.error(`Error writing to ${nombreObjeto}.csv:`, err);
    } else {
      console.log(`Data appended to ${nombreObjeto}.csv`);
    }
  });
}
