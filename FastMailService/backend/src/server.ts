import bcrypt from "bcrypt";
import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import session from "express-session";
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
import {
  Cliente,
  Envio,
  Flujo,
  Paquete,
  UserSession,
  ZipCodeRange,
} from "./types/types";

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(
  session({
    secret: "SOME_SECRET_KEY",
    resave: false,
    saveUninitialized: true,
  })
);

const chatbotSesionesDeUsuario: { [key: string]: UserSession } = {};

// Simulación de base de datos
const users: { username: string; password: string }[] = [];

// Extend the Express Request interface
declare module "express-session" {
  interface SessionData {
    userId: any;
  }
}

// Middleware de autenticación
function isAuthenticated(req: Request, res: Response, next: () => any) {
  if (req.session.userId) {
    return next(); // El usuario está autenticado, continuar con la siguiente función
  }
  res.status(401).send("No autorizado"); // El usuario no está autenticado
}

// Ruta para registrar un nuevo usuario
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ username, password: hashedPassword });
  res.status(201).send("Usuario registrado");
});

// Ruta para iniciar sesión
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username);
  if (user && (await bcrypt.compare(password, user.password))) {
    // Declare userId property on session
    (req.session as any).userId = user.username; // Guardar el ID de usuario en la sesión
    res.send("Inicio de sesión exitoso");
  } else {
    res.status(401).send("Credenciales incorrectas");
  }
});

// Ruta para cerrar sesión
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Error al cerrar sesión");
    }
    res.send("Sesión cerrada");
  });
});

// Rutas protegidas
app.get("/ruta-protegida", isAuthenticated, (req, res) => {
  res.send(
    "Esta es una ruta protegida, solo accesible para usuarios autenticados."
  );
});

app.get("/", isAuthenticated, (req, res) => {
  console.log(`get request from ${req.query.From}`);
  res.send("Hello World");
});

app.post("/chatbot", (req: Request, res: Response) => {
  const incomingMessage = req.body.Body;
  const cliente = req.body.From;

  console.log(`Mensaje recibido de ${cliente}: ${incomingMessage}`);

  if (!chatbotSesionesDeUsuario[cliente]) {
    chatbotSesionesDeUsuario[cliente] = { flujo: { paso: "bienvenida" } };
  }

  const sesionCliente = chatbotSesionesDeUsuario[cliente];

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
  // console.log(`Current subpaso: ${flujo.subpaso}`);

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
      crear_envio(sender, message);
      calcular_costos(sender);
      flujo.subpaso = "eligiendo_tarifa";
      break;
    case "eligiendo_tarifa":
      // calcular_costos(sender);
      break;
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
  const sesionCliente = chatbotSesionesDeUsuario[sender];

  // Verificar si el mensaje contiene múltiples paquetes
  const paquetes = message.includes(";")
    ? message.split(";").map((dato) => dato.trim())
    : [message.trim()]; // Si no hay ";", se asume un solo paquete

  // console.log("Paquetes recibidos:", paquetes);

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

function crear_envio(sender: string, message: string) {
  const sesionCliente = chatbotSesionesDeUsuario[sender];
  // const envios: Envio[] = [];
  const paquetes: Paquete[] | undefined = sesionCliente.paquetes;
  const remitente = sesionCliente?.remitente;
  const destinatario = sesionCliente?.destinatario;

  if (!paquetes) {
    console.log("No hay paquetes en la sesión");
    sendErrorMessage(sender);
    return;
  }
  if (!remitente) {
    console.log("No hay remitente en la sesión");
    sendErrorMessage(sender);
    return;
  }
  if (!destinatario) {
    console.log("No hay destinatario en la sesión");
    sendErrorMessage(sender);
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
  emular_post_db_general("envios", envio, "create");
  // envios.push(envio);
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
  const sesionCliente = chatbotSesionesDeUsuario[sender];
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

  let mensaje_costo = `Tenemos las siguientes tarifas:\n`;

  let mensaje_costo_8_30 = `1. Bajo la tarifa de Fedex 8:30, cada paquete tiene un costo de:\n`;
  let mensaje_costo_10_30 = `2. Bajo la tarifa de Fedex 10:30, el costo de envío es de:\n`;
  let mensaje_costo_economico = `3. Bajo la tarifa de Fedex económico, el costo de envío es de:\n`;
  let mensaje_costo_dia_siguiente = `4. Bajo la tarifa de Fedex día siguiente, el costo de envío es de:\n`;

  for (let paquete of paquetes) {
    const peso = Math.ceil(paquete.peso);
    const costo_fedex_8_30 =
      TarifaNacional_8_30.Paquetes[peso][Number(ZonaEnvio)];
    mensaje_costo_8_30 += `Paquete ${JSON.stringify(paquete)}: \n`;
    mensaje_costo_8_30 += `- ${costo_fedex_8_30}\n`;
    paquete.costo = costo_fedex_8_30;

    const costo_fedex_10_30 =
      TarifaNacional_10_30.Paquetes[peso][Number(ZonaEnvio)];
    mensaje_costo_10_30 += `Paquete ${JSON.stringify(paquete)}: \n`;
    mensaje_costo_10_30 += `- ${costo_fedex_10_30}\n`;
    paquete.costo = costo_fedex_10_30;
    const costo_fedex_economico =
      TarifaNacional_Economico.Paquetes[peso][Number(ZonaEnvio)];
    mensaje_costo_economico += `Paquete ${JSON.stringify(paquete)}: \n`;
    mensaje_costo_economico += `- ${costo_fedex_economico}\n`;
    paquete.costo = costo_fedex_economico;

    const costo_fedex_dia_siguiente =
      TarifaNacional_Dia_Siguiente.Paquetes[peso][Number(ZonaEnvio)];
    mensaje_costo_dia_siguiente += `Paquete ${JSON.stringify(paquete)}: \n`;
    mensaje_costo_dia_siguiente += `- ${costo_fedex_dia_siguiente}\n`;
    paquete.costo = costo_fedex_dia_siguiente;
  }
  mensaje_costo += `\n${mensaje_costo_8_30}\n${mensaje_costo_10_30}\n${mensaje_costo_economico}\n${mensaje_costo_dia_siguiente}\n Elige una de las tarifas para continuar`;

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

function elegir_tarifa(sender: string, message: string) {
  const sesionCliente = chatbotSesionesDeUsuario[sender];
  const tarifa_seleccionada = message;
  switch (tarifa_seleccionada) {
    case "1":
    case "8:30":
      sesionCliente.tarifa = TarifaNacional_8_30;
      break;
    case "2":
    case "10:30":
      sesionCliente.tarifa = TarifaNacional_10_30;
      break;
    case "3":
    case "economico":
      sesionCliente.tarifa = TarifaNacional_Economico;
      break;
    case "4":
    case "dia_siguiente":
      sesionCliente.tarifa = TarifaNacional_Dia_Siguiente;
      break;
  }
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

function identifyObjectType(data: any): string {
  if ("nombre" in data && "calle" in data && "codigoPostal" in data) {
    return "Cliente";
  } else if (
    "remitente" in data &&
    "destinatario" in data &&
    "paquetes" in data
  ) {
    return "Envio";
  } else if (
    "alto" in data &&
    "ancho" in data &&
    "largo" in data &&
    "peso" in data
  ) {
    return "Paquete";
  }
  return "Unknown";
}

function formatDataForCSV(data: any, type: string): string {
  switch (type) {
    case "Cliente":
      return `${data.nombre},${data.calle},${data.codigoPostal},${data.colonia},${data.ciudad},${data.estado},${data.celular}`;
    case "Envio":
      return `Remitente: ${formatDataForCSV(
        data.remitente,
        "Cliente"
      )}, Destinatario: ${formatDataForCSV(
        data.destinatario,
        "Cliente"
      )}, Paquetes: ${data.paquetes
        .map((p: any) => formatDataForCSV(p, "Paquete"))
        .join("; ")}`;
    case "Paquete":
      return `${data.alto}cm,${data.ancho}cm,${data.largo}cm,${data.peso}kg`;
    default:
      return JSON.stringify(data);
  }
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

  const filePath = path.join(__dirname, "../db", `${some_entity_name}.csv`);
  const objectType = identifyObjectType(some_entity_data);
  const data = formatDataForCSV(some_entity_data, objectType) + "\n";

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
