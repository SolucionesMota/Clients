import { client, sandboxNumber } from "../config/twilio-config";
import { fetchSigilmexData } from "../integrations/sigylmex/sigylmex";
import { envioSigylmex } from "../integrations/sigylmex/sigylmex-types";
import { fetchStripeData } from "../integrations/stripe/stripe";
import { Checkout_Session } from "../integrations/stripe/stripe-types";
import { UserSession } from "../types/types";

// ** Constantes y Variables Globales **
const chatbotSesionesDeUsuario: { [key: string]: UserSession } = {};

// const FORMATO_DATOS_PLANTILLA = `
// *Solicitud de guía *
// Respuesta #10729

// *Solicitud de guía *

// Remitente  : Nombre completo o razón social
// Domicilio de origen : Calle, Colonia, Código Postal, Ciudad, Estado
// Código postal de origen :
// Destinatario  : Nombre completo o razón social
// Dirección de destino : Calle, Colonia, Código Postal, Ciudad, Estado
// Código postal de destino  :
// Teléfono de destinatario  :
// Peso y medidas : Peso en kg Largo x Ancho x Alto
// Contenido  :
// Paquetería y tipo de servicio  :
// `;

const MENSAJE_BIENVENIDA = `¡Hola! 😊 ¿Cómo puedo ayudarte hoy? Por favor elige una de las siguientes opciones:
  1. *Comprar* - Comprar una guía.
  2. *Cotizar* - Cotizar una guía.
  3. *Soporte* -   Contactar a soporte.`;

const MENSAJE_PROCESO_EN_DESARROLLO =
  "Este proceso está en desarrollo, por favor espere a que se habilite";

const MENSAJE_ELEGIR_TARIFA = `Si quieres comprar elige la tarifa que deseas:
1. Tarifa 8:30
2. Tarifa 10:30
3. Tarifa Dia siguiente
4. Tarifa Economica`;

const MENSAJE_DE_PAGO = `Le compartimos nuestros Métodos de pago ✅💲
Por favor envia un mensaje de confirmación cuando hayas realizado el pago:

1 ✅Transferencia
Jorge Michel Gallardo

Institución Mercado pago W
Cuenta CLABE: 722969010270278149

2 ✅Deposito
Banco INBURSA (Oxxo, Walmart, Telecomm, Telcel, Sanborns).

1234 1234 1234 1234(Solo deposito, no transferencia)

3 ✅Pago con Tarjeta (Débito o Crédito)
Ingresa el monto solicitado en el siguiente link:

https://buy.stripe.com/test_dR616d9pEfqscE09AC

4 ✅ PayPal
Ingresa el monto solicitado en el siguiente link:

https://www.paypal.me/pago

5 ✅ Mercado Pago
Ingresa el monto solicitado en el siguiente link:

link.mercadopago.com.mx/pagoe `;

const MENSAJE_PAGO_EXITOSO = `¡Gracias! Tu compra ha sido realizada con éxito.`;

//const MENSAJE_COTIZACIONES_FINALIZADAS = `Cotizaciones finalizadas. ¿Deseas comprar alguna de estas guías?
//1. *Sí, comprar*.
//2. *No, gracias*.`;
const MENSAJE_COTIZACIONES_FINALIZADAS = `elige una de las tarifas para comprar`;

const MENSAJE_SELECCIONAR_TARIFA_COMPRA = `Por favor, selecciona el número de la tarifa que deseas comprar:`;
const MENSAJE_AVISAME_PAGO = `Avísame cuando hayas pagado y el método que usaste para validarlo y proceder a generar tu guía.`;
const MENSAJE_FORMATO_INCORRECTO = `El formato de los datos proporcionados no coincide con la plantilla esperada. Por favor, asegúrate de usar el siguiente formulario para enviar tus datos.`;
// const MENSAJE_REINTENTAR_PLANTILLA = `Por favor, utiliza la siguiente plantilla para enviarnos tus datos nuevamente:`;
const FORMULARIO_ENLACE = `https://whatsform.com/Up1kEP`;
const MENSAJE_ENLACE_FORMULARIO = `asegúrate de usar el siguiente formulario para enviar tus datos: ${FORMULARIO_ENLACE}`;

// ** Funciones Utilitarias **

/**
 * Envía un mensaje de texto al cliente usando la API de Twilio.
 * @param {string} sender Número de teléfono del cliente.
 * @param {string} body Cuerpo del mensaje a enviar.
 * @param {string} logMessage Mensaje para registrar en la consola.
 */
function sendMessage(sender: string, body: string, logMessage: string) {
  client.messages
    .create({
      body,
      from: sandboxNumber,
      to: sender,
    })
    .then((message) => {
      // console.log("log para twilio", message);
      // console.log(`${logMessage}: ${message.sid}`);
      // console.log(`Mensaje enviado: ${body}`);
    })
    .catch((err) => console.error(`Error enviando mensaje: ${err}`));
}

/**
 * Normaliza el número de teléfono usando la API de Lookup de Twilio.
 * @param {string} phoneNumber Número de teléfono a normalizar.
 * @returns {Promise<string | null>} Número de teléfono normalizado o null en caso de error.
 */
async function getNormalizedNumber(
  phoneNumber: string
): Promise<string | null> {
  try {
    const numberInfo = await client.lookups.v2
      .phoneNumbers(phoneNumber)
      .fetch();
    return numberInfo.phoneNumber;
  } catch (error) {
    console.error("Error al obtener el número normalizado:", error);
    return null;
  }
}

// /**
//  * Limpia y normaliza el nombre de un estado para comparaciones y búsquedas.
//  * @param {string} estado Nombre del estado.
//  * @returns {string} Nombre del estado normalizado.
//  */
// function limpiarEstado(estado: string): string {
//   return estado
//     .split(" ")
//     .join("_")
//     .toLowerCase()
//     .replace(/á/g, "a")
//     .replace(/é/g, "e")
//     .replace(/í/g, "i")
//     .replace(/ó/g, "o")
//     .replace(/ú/g, "u")
//     .replace(/ñ/g, "n")
//     .replace(/[^a-z0-9_]/g, "");
// }

/**
 * Parsea la cadena de dirección y la convierte en un objeto de dirección estructurado.
 * @param {string | undefined} direccionStr Cadena de dirección sin procesar.
 * @returns {Direccion} Objeto de dirección estructurado.
 */
function parseDireccion(direccionStr: string | undefined) {
  if (!direccionStr) {
    return { calle: "", colonia: "", codigoPostal: "", ciudad: "", estado: "" };
  }
  const parts = direccionStr.split(",");
  return {
    calle: parts[0]?.trim() || "",
    colonia: parts[1]?.trim() || "", // Antes era el código postal
    codigoPostal: parts[2]?.trim() || "",
    ciudad: parts[3]?.trim() || "",
    estado: parts[4]?.trim() || "",
  };
}

/**
 * Procesa el mensaje entrante del usuario y extrae los datos de envío.
 * @param {string} message Mensaje del usuario conteniendo los datos.
 * @param {UserSession} sesionCliente Sesión actual del usuario.
 * @returns {boolean} Retorna true si el formato es correcto, false si no lo es.
 */
function parseData(message: string, sesionCliente: UserSession): boolean {
  console.log("Mensaje entrante a parseData:", message);

  const lines = message
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  const remitenteData: Record<string, string> = {};
  const destinatarioData: Record<string, string> = {};
  const paqueteData: Record<string, string> = {};
  let parsedFieldsCount = 0;

  for (const line of lines) {
    // Eliminar asteriscos y otros caracteres no deseados de la línea ANTES de dividir
    const cleanLine = line.replace(/\*/g, "").trim();

    const parts = cleanLine.split(":"); // Ahora dividimos la línea limpia
    if (parts.length > 1) {
      const key = parts[0].trim().toLowerCase(); // La clave ya está limpia
      const value = parts.slice(1).join(":").trim(); // El valor ya está limpio

      parsedFieldsCount++;

      switch (key) {
        case "remitente":
          remitenteData["nombre"] = value;
          break;
        case "domicilio de origen":
          remitenteData["direccion"] = value;
          break;
        case "código postal de origen":
          remitenteData["codigoPostal"] = value;
          break;
        case "destinatario":
          destinatarioData["nombre"] = value;
          break;
        case "dirección de destino":
          destinatarioData["direccion"] = value;
          break;
        case "código postal de destino":
          destinatarioData["codigoPostal"] = value;
          break;
        case "teléfono destinatario":
        case "telefono destinatario":
          destinatarioData["celular"] = value;
          break;
        case "peso":
          paqueteData["peso"] = value.replace("kg", "").trim(); // Solo quitamos "kg"
          console.log("peso", paqueteData["peso"]);
          break;
        case "medidas":
        case "Medidas":
          const [largo, ancho, alto] = value.split("x").map((s) => s.trim());
          paqueteData["largo"] = largo;
          paqueteData["ancho"] = ancho;
          paqueteData["alto"] = alto;
          break;
        case "contenido":
          paqueteData["contenido"] = value;
          break;
        case "paquetería y tipo de servicio":
        case "paqueteria y tipo de servicio":
          paqueteData["servicio"] = value;
          paqueteData["paqueteria"] = value;
          break;
      }
    }
  }

  console.log("Datos parseados de remitente:", remitenteData);
  console.log("Datos parseados de destinatario:", destinatarioData);
  console.log("Datos parseados de paquete:", paqueteData);

  // Validación y mensajes de error mejorados
  if (parsedFieldsCount === 0) {
    console.log("No se pudo reconocer ningún dato del mensaje.");
    return false; // No se pudo analizar nada
  }
  if (
    !remitenteData["nombre"] ||
    !remitenteData["direccion"] ||
    !remitenteData["codigoPostal"] ||
    !destinatarioData["nombre"] ||
    !destinatarioData["direccion"] ||
    !destinatarioData["codigoPostal"] ||
    !destinatarioData["celular"] ||
    !paqueteData["peso"] ||
    !paqueteData["largo"] ||
    !paqueteData["ancho"] ||
    !paqueteData["alto"] ||
    !paqueteData["contenido"] ||
    !paqueteData["servicio"]
  ) {
    console.log("Formato de datos incompleto: Faltan campos esenciales.");
    return false; // Faltan campos esenciales
  }

  sesionCliente.remitente = {
    nombre: remitenteData["nombre"] || "",
    direccion: {
      ...parseDireccion(remitenteData["direccion"]),
      codigoPostal: remitenteData["codigoPostal"] || "",
    },
    celular: "",
    correo: "",
  };

  sesionCliente.destinatario = {
    nombre: destinatarioData["nombre"] || "",
    direccion: {
      ...parseDireccion(destinatarioData["direccion"]),
      codigoPostal: destinatarioData["codigoPostal"] || "",
    },
    celular: destinatarioData["celular"] || "",
    correo: "",
  };

  sesionCliente.paquetes = [
    {
      alto: parseFloat(paqueteData["alto"] || "0"),
      ancho: parseFloat(paqueteData["ancho"] || "0"),
      largo: parseFloat(paqueteData["largo"] || "0"),
      peso: parseFloat(paqueteData["peso"] || "0"),
      costo: 0,
      paqueteria: paqueteData["paqueteria"] || "",
    },
  ];

  console.log("Datos parseados de remitente:", sesionCliente.remitente);
  console.log("Datos parseados de destinatario:", sesionCliente.destinatario);
  console.log("Datos parseados de paquete:", sesionCliente.paquetes);
  return true;
}

// function parseData(message: string, sesionCliente: UserSession): boolean {
//   console.log("Mensaje entrante a parseData:", message);

//   const lines = message
//     .split("\n")
//     .map((line) => line.trim())
//     .filter((line) => line !== "");

//   const remitenteData: Record<string, string> = {};
//   const destinatarioData: Record<string, string> = {};
//   const paqueteData: Record<string, string> = {};
//   let parsedFieldsCount = 0;

//   for (const line of lines) {
//     // Modificación para manejar el formato "*Clave :* Valor"
//     const parts = line.split(":");
//     if (parts.length > 1) {
//       // Eliminar asteriscos alrededor de la clave y espacios en blanco
//       const keyWithAsterisks = parts[0].trim();
//       const key = keyWithAsterisks.replace(/\*/g, "").trim().toLowerCase();
//       const value = parts.slice(1).join(":").trim();
//       parsedFieldsCount++; // Increment count if a field is parsed
//       switch (key) {
//         case "remitente":
//           remitenteData["nombre"] = value;
//           break;
//         case "domicilio de origen":
//           remitenteData["direccion"] = value;
//           break;
//         case "código postal de origen":
//           remitenteData["codigoPostal"] = value;
//           break;
//         case "destinatario":
//           destinatarioData["nombre"] = value;
//           break;
//         case "dirección de destino":
//           destinatarioData["direccion"] = value;
//           break;
//         case "código postal de destino":
//           destinatarioData["codigoPostal"] = value;
//           break;
//         case "teléfono destinatario": // Corregido el nombre de la clave para coincidir con el input
//           destinatarioData["celular"] = value;
//           break;
//         case "peso":
//           const [peso] = value.trim();
//           paqueteData["peso"] = peso.replace("kg", "").trim();
//           console.log("peso", peso);
//           break;
//         case "dimensiones":
//           const [largo, ancho, alto] = value.split("x");
//           paqueteData["largo"] = largo;
//           paqueteData["ancho"] = ancho;
//           paqueteData["alto"] = alto;
//           break;
//         case "contenido":
//           paqueteData["contenido"] = value;
//           break;
//         case "paquetería y tipo de servicio":
//           paqueteData["servicio"] = value;
//           paqueteData["paqueteria"] = value;
//           break;
//       }
//     }
//   }

//   console.log("Datos parseados de remitente:", remitenteData);
//   console.log("Datos parseados de destinatario:", destinatarioData);
//   console.log("Datos parseados de paquete:", paqueteData);

//   // Validación de campos mínimos (ajustado a los campos del formato específico)
//   if (
//     !remitenteData["nombre"] ||
//     !remitenteData["direccion"] ||
//     !remitenteData["codigoPostal"] ||
//     !destinatarioData["nombre"] ||
//     !destinatarioData["direccion"] ||
//     !destinatarioData["codigoPostal"] ||
//     !destinatarioData["celular"] ||
//     !paqueteData["peso"] ||
//     !paqueteData["largo"] ||
//     !paqueteData["ancho"] ||
//     !paqueteData["alto"] ||
//     !paqueteData["contenido"] ||
//     !paqueteData["servicio"]
//   ) {
//     console.log(
//       "Formato de datos incorrecto: Campos esenciales vacíos o incompletos"
//     );
//     return false; // Indicate incorrect format if essential fields are empty after parsing
//   }

//   sesionCliente.remitente = {
//     nombre: remitenteData["nombre"] || "",
//     direccion: {
//       ...parseDireccion(remitenteData["direccion"]),
//       codigoPostal: remitenteData["codigoPostal"] || "",
//     },
//     celular: "",
//     correo: "",
//   };

//   sesionCliente.destinatario = {
//     nombre: destinatarioData["nombre"] || "",
//     direccion: {
//       ...parseDireccion(destinatarioData["direccion"]),
//       codigoPostal: destinatarioData["codigoPostal"] || "",
//     },
//     celular: destinatarioData["celular"] || "",
//     correo: "",
//   };

//   sesionCliente.paquetes = [
//     {
//       alto: parseFloat(paqueteData["alto"] || "0"),
//       ancho: parseFloat(paqueteData["ancho"] || "0"),
//       largo: parseFloat(paqueteData["largo"] || "0"),
//       peso: parseFloat(paqueteData["peso"] || "0"),
//       costo: 0,
//       paqueteria: paqueteData["paqueteria"] || "",
//     },
//   ];

//   console.log("Datos parseados de remitente:", sesionCliente.remitente);
//   console.log("Datos parseados de destinatario:", sesionCliente.destinatario);
//   console.log("Datos parseados de paquete:", sesionCliente.paquetes);
//   return true; // Indicate correct format
// }

// ** Funciones de Flujo del Chatbot **

/**
 * Maneja la lógica principal al elegir un proceso (Comprar, Cotizar, Soporte).
 * @param {string} sender Número de teléfono del cliente.
 * @param {string} choice Opción elegida por el cliente.
 * @param {UserSession} sesionCliente Sesión actual del usuario.
 */
function eligiendoProcesoMain(
  sender: string,
  choice: string,
  sesionCliente: UserSession
) {
  sesionCliente.flujo.subpaso = "";
  const normalizedChoice = choice.toLowerCase();

  if (["1", "comprar"].includes(normalizedChoice)) {
    if (sesionCliente.cotizacion) {
      sendMessage(
        sender,
        "Ya tienes una compra en proceso.",
        "Proceso compra en curso"
      );
      console.log("Cotización existente:", sesionCliente.cotizacion);
    } else {
      sesionCliente.flujo.paso = "compra";
      sendMessage(
        sender,
        `Por favor llena el siguiente formulario ${FORMULARIO_ENLACE} para enviar tus datos`,
        "Instrucciones para datos de envío"
      );
      // sendMessage(
      //   sender,
      //   FORMATO_DATOS_PLANTILLA,
      //   "Solicitando datos de envío"
      // );
    }
  } else if (["2", "cotizar"].includes(normalizedChoice)) {
    sesionCliente.flujo.paso = "cotizar";
    sendMessage(
      sender,
      `Por favor llena el siguiente formulario ${FORMULARIO_ENLACE} para enviar tus datos`,
      "Instrucciones para datos de envío"
    );
    // sendMessage(sender, FORMATO_DATOS_PLANTILLA, "Solicitando datos de envío");
  } else if (["3", "soporte"].includes(normalizedChoice)) {
    sesionCliente.flujo.paso = ""; // Sale del flujo principal
    sendMessage(sender, MENSAJE_PROCESO_EN_DESARROLLO, "Proceso soporte");
  } else {
    sendMessage(
      sender,
      "Opción no válida. Por favor, elige:\n1. Comprar\n2. Cotizar\n3. Soporte",
      "Opción inválida"
    );
  }
}

/**
 * Cotiza el envío utilizando la API de Sigylmex y muestra las opciones al usuario.
 * @param {string} sender Número de teléfono del cliente.
 * @param {UserSession} sesionCliente Sesión actual del usuario.
 */
async function cotizarSigylmex(sender: string, sesionCliente: UserSession) {
  if (
    !sesionCliente.paquetes ||
    !sesionCliente.remitente ||
    !sesionCliente.destinatario
  ) {
    sendMessage(
      sender,
      "Faltan datos para la cotización.",
      "Error en cotización"
    );
    return;
  }
  if (sesionCliente.paquetes.length > 1) {
    sendMessage(
      sender,
      "Lo sentimos, por el momento solo podemos cotizar un paquete a la vez.",
      "Error en cotización múltiple"
    );
    return;
  }

  const envio: envioSigylmex = {
    origen: sesionCliente.remitente?.direccion.codigoPostal,
    destino: sesionCliente.destinatario?.direccion.codigoPostal,
    peso: sesionCliente.paquetes[0].peso.toString(),
    largo: sesionCliente.paquetes[0].largo.toString(),
    alto: sesionCliente.paquetes[0].alto.toString(),
    ancho: sesionCliente.paquetes[0].ancho.toString(),
  };

  console.log(
    "Datos de sesionCliente antes de cotizarSigylmex:",
    sesionCliente
  ); // AÑADIDO LOG
  console.log("envio", envio);

  try {
    const cotizacionesSigylmex = await fetchSigilmexData("cotizar", "", envio);
    console.log("Cotizaciones de Sigylmex:", cotizacionesSigylmex);

    if (cotizacionesSigylmex && cotizacionesSigylmex.length > 0) {
      let mensajeCotizaciones = "Cotizaciones disponibles:\n";
      cotizacionesSigylmex.forEach(
        (cotizacion: { servicio: any; total: any }, index: number) => {
          mensajeCotizaciones += `${index + 1}. *${cotizacion.servicio}*: $${
            cotizacion.total
          }\n`;
        }
      );
      sendMessage(
        sender,
        mensajeCotizaciones + `\n${MENSAJE_COTIZACIONES_FINALIZADAS}`, // Use the modified message here
        "Cotizaciones de Sigylmex enviadas"
      );
      sesionCliente.cotizacionSigylmex = cotizacionesSigylmex; // Guarda las cotizaciones en sesión
      sesionCliente.flujo.subpaso = "esperando_decision_compra_cotizacion"; // Esperando decision compra o no despues de cotizar. This subpaso name is now misleading, but keep it for flow consistency, as the question changed.
    } else {
      sendMessage(
        sender,
        "No se encontraron cotizaciones para esta ruta.",
        "Sin cotizaciones de Sigylmex"
      );
      sesionCliente.flujo.subpaso = ""; // Finaliza el subpaso de cotización
    }
  } catch (error) {
    console.error("Error al obtener cotizaciones de Sigylmex:", error);
    sendMessage(
      sender,
      "Error al obtener cotizaciones. Por favor, intenta más tarde.",
      "Error API Sigylmex"
    );
    sesionCliente.flujo.subpaso = ""; // Finaliza el subpaso de cotización
  }
}

function seleccionarTarifaParaCompra(
  sender: string,
  message: string,
  sesionCliente: UserSession
) {
  if (
    !sesionCliente.cotizacionSigylmex ||
    sesionCliente.cotizacionSigylmex.length === 0
  ) {
    sendMessage(
      sender,
      "No hay cotizaciones disponibles para seleccionar.",
      "Error selección cotización"
    );
    sesionCliente.flujo.subpaso = "";
    return;
  }

  const opcionSeleccionada = parseInt(message.trim());
  if (
    isNaN(opcionSeleccionada) ||
    opcionSeleccionada < 1 ||
    opcionSeleccionada > sesionCliente.cotizacionSigylmex.length
  ) {
    sendMessage(
      sender,
      `Opción inválida. Por favor, selecciona un número de cotización del 1 al ${sesionCliente.cotizacionSigylmex.length}.`,
      "Selección incorrecta de tarifa"
    );
    return;
  }

  const cotizacionSeleccionada =
    sesionCliente.cotizacionSigylmex[opcionSeleccionada - 1];
  sesionCliente.envios = [
    {
      remitente: sesionCliente.remitente!,
      destinatario: sesionCliente.destinatario!,
      paquetes: sesionCliente.paquetes!,
      tarifa: {
        nombre: cotizacionSeleccionada.servicio,
        costo: cotizacionSeleccionada.total,
      },
      fechaEnvio: new Date(),
      fechaEntrega: new Date(),
      estado: "prospecto",
      _id: "1",
      checkout_session_id: "",
      costo: cotizacionSeleccionada.total,
    },
  ];

  sendMessage(sender, MENSAJE_DE_PAGO, "Mensaje eleccion pago");
  sendMessage(sender, MENSAJE_AVISAME_PAGO, "Mensaje avisame pago stripe"); // Added message after payment methods for stripe
  sesionCliente.flujo.subpaso = "esperando_confirmacion_pago";
}

function esCompra(sender: string, message: string, sesionCliente: UserSession) {
  // This function is now called when user chooses "Comprar" from main menu, or "Sí, comprar" after cotizacion
  if (
    sesionCliente.cotizacionSigylmex &&
    sesionCliente.cotizacionSigylmex.length > 0 &&
    sesionCliente.flujo.subpaso === "mostrando_cotizaciones_sigylmex_compra"
  ) {
    // User is buying after cotizacion, need to select tarifa number
    sesionCliente.flujo.subpaso = "esperando_seleccion_tarifa_compra";
    sendMessage(
      sender,
      MENSAJE_SELECCIONAR_TARIFA_COMPRA,
      "Solicitando seleccion de tarifa para compra"
    );
  } else if (
    sesionCliente.flujo.paso === "compra" &&
    sesionCliente.flujo.subpaso === "mostrando_cotizaciones_sigylmex"
  ) {
    // User initiated compra directly and quotes are shown, need to select tarifa number
    sesionCliente.flujo.subpaso = "esperando_seleccion_tarifa_compra";
    sendMessage(
      sender,
      MENSAJE_SELECCIONAR_TARIFA_COMPRA,
      "Solicitando seleccion de tarifa para compra"
    );
  } else {
    sendMessage(
      sender,
      "No hay cotizaciones disponibles para seleccionar o flujo incorrecto.",
      "Error al iniciar compra"
    );
    sesionCliente.flujo.subpaso = "";
  }
}

/**
 * Confirma el pago del cliente verificando con Stripe (lógica simplificada).
 * @param {string} sender Número de teléfono del cliente.
 * @param {string} message Mensaje del cliente confirmando el pago.
 * @param {UserSession} sesionCliente Sesión actual del usuario.
 */
async function confirmarPago(
  sender: string,
  message: string,
  sesionCliente: UserSession
) {
  sesionCliente.remitente!.celular =
    (await getNormalizedNumber(sender.split(":")[1])) ?? "";
  const envio_remitente_celular = sesionCliente.remitente!.celular;
  const envio_remitente_nombre = sesionCliente.remitente!.nombre;
  const envio_monto = sesionCliente.envios![0].costo;

  console.log("Inicio de confirmación de pago");
  console.log("Mensaje recibido:", message);

  const lowerMessage = message.toLowerCase().trim();

  if (!lowerMessage) {
    console.log("Mensaje vacío recibido, solicitando datos nuevamente");
    sendMessage(
      sender,
      "No recibimos detalles sobre el método de pago. Por favor indica claramente cómo realizaste el pago.",
      "Mensaje vacío - Solicitar datos"
    );
    return;
  }

  if (
    lowerMessage.includes("transferencia") ||
    lowerMessage.includes("banco")
  ) {
    console.log("Validando pago por transferencia");
    sendMessage(
      sender,
      "Pago por transferencia recibido.",
      "Pago confirmado - Transferencia"
    );
    sesionCliente.flujo.subpaso = "";
    sesionCliente.flujo.paso = "";
    return;
  } else if (
    lowerMessage.includes("deposito") ||
    lowerMessage.includes("depósito")
  ) {
    console.log("Validando pago por depósito");
    sendMessage(
      sender,
      "Pago por depósito recibido.",
      "Pago confirmado - Depósito"
    );
    sesionCliente.flujo.subpaso = "";
    sesionCliente.flujo.paso = "";
    return;
  } else if (lowerMessage.includes("paypal")) {
    console.log("Validando pago por PayPal");
    sendMessage(
      sender,
      "Pago por PayPal recibido.",
      "Pago confirmado - PayPal"
    );
    sesionCliente.flujo.subpaso = "";
    sesionCliente.flujo.paso = "";
    return;
  } else if (
    lowerMessage.includes("mercado pago") ||
    lowerMessage.includes("mercadopago")
  ) {
    console.log("Validando pago por Mercado Pago");
    sendMessage(
      sender,
      "Pago por Mercado Pago recibido.",
      "Pago confirmado - Mercado Pago"
    );
    sesionCliente.flujo.subpaso = "";
    sesionCliente.flujo.paso = "";
    return;
  } else if (
    lowerMessage.includes("tarjeta") ||
    lowerMessage.includes("stripe") ||
    lowerMessage.includes("crédito") ||
    lowerMessage.includes("debito")
  ) {
    console.log("Validando pago por tarjeta (Stripe)");
    try {
      const checkout_sessions_data = await fetchStripeData("checkout/sessions");
      const checkout_sessions: Checkout_Session[] = checkout_sessions_data.data;
      const most_recent_checkout_session = checkout_sessions[0];

      if (!most_recent_checkout_session) {
        console.log("No se encontró información de pago reciente en Stripe");
        sendMessage(
          sender,
          "No se encontró información de pago reciente. Por favor contacta a soporte.",
          "Pago no encontrado"
        );
        return;
      }

      console.log("Datos del pago en Stripe:", most_recent_checkout_session);

      const checkout_celular =
        most_recent_checkout_session.customer_details?.phone;
      const checkout_nombre =
        most_recent_checkout_session.customer_details?.name;
      const checkout_monto = most_recent_checkout_session.amount_total;

      if (checkout_celular === envio_remitente_celular) {
        if (checkout_monto < envio_monto) {
          console.log("Monto de pago incorrecto");
          sendMessage(
            sender,
            "El pago no es correcto, ponte en contacto con soporte.",
            "Pago incorrecto - Monto"
          );
        } else {
          console.log("Pago validado correctamente");
          sendMessage(
            sender,
            "¡El pago es correcto! Procederemos a generar la guía de envío.",
            "Pago correcto"
          );
          sendMessage(sender, MENSAJE_PAGO_EXITOSO, "Pago exitoso - Cliente");
        }
        sesionCliente.flujo.subpaso = "";
        sesionCliente.flujo.paso = "";
      } else {
        console.log("El último pago registrado no corresponde al remitente");
        sendMessage(
          sender,
          "El último pago registrado no corresponde al remitente. Por favor contacta a soporte.",
          "Pago incorrecto - Remitente"
        );
        sesionCliente.flujo.subpaso = "";
        sesionCliente.flujo.paso = "";
      }
    } catch (error) {
      console.error("Error al verificar el pago con Stripe:", error);
      sendMessage(
        sender,
        "Error al verificar el pago. Por favor contacta a soporte.",
        "Error Stripe API"
      );
      sesionCliente.flujo.subpaso = "";
      sesionCliente.flujo.paso = "";
    }
    return;
  }

  console.log("No se reconoce el método de pago");
  sendMessage(
    sender,
    "Método de pago no reconocido. Por favor indica claramente cómo realizaste el pago.",
    "Método de pago desconocido"
  );
}

/**
 * Flujo para el proceso de compra.
 * @param {string} sender Número de teléfono del cliente.
 * @param {string} message Mensaje del cliente.
 * @param {UserSession} sesionCliente Sesión actual del usuario.
 */
function comprando(
  sender: string,
  message: string,
  sesionCliente: UserSession
) {
  console.log(
    `Flujo Comprando, subpaso actual: ${sesionCliente.flujo.subpaso}`
  );
  if (!sesionCliente.flujo.subpaso || sesionCliente.flujo.subpaso === "") {
    sesionCliente.flujo.subpaso = "ingresando_datos_envio";
  }

  switch (sesionCliente.flujo.subpaso) {
    case "ingresando_datos_envio":
      const isValidFormat = parseData(message, sesionCliente);
      if (!isValidFormat) {
        sendMessage(
          sender,
          MENSAJE_FORMATO_INCORRECTO,
          "Formato de datos incorrecto"
        );
        sendMessage(sender, MENSAJE_ENLACE_FORMULARIO, "Enlace al formulario");
        sesionCliente.flujo.subpaso = "ingresando_datos_envio"; // Stay in the same sub-step to retry data input
      } else {
        console.log(
          "Sesion cliente despues de parseData en Comprando:",
          sesionCliente
        ); // LOG AÑADIDO
        cotizarSigylmex(sender, sesionCliente); // Cotizar con Sigylmex
        sesionCliente.flujo.subpaso = "mostrando_cotizaciones_sigylmex"; // Transition to show quotes in compra flow
      }
      break;
    case "mostrando_cotizaciones_sigylmex":
      // Now 'esCompra' function will handle the next step when in 'compra' flow and subpaso 'mostrando_cotizaciones_sigylmex'
      esCompra(sender, message, sesionCliente); // Call esCompra to handle tarifa selection
      break;
    case "esperando_seleccion_tarifa_compra":
      seleccionarTarifaParaCompra(sender, message, sesionCliente); // Process user's tariff selection
      break;
    case "esperando_confirmacion_pago":
      confirmarPago(sender, message, sesionCliente);
      break;
    default:
      sendMessage(
        sender,
        "No entiendo tu mensaje en el flujo de compra.",
        "Mensaje no entendido - Compra"
      );
      break;
  }
}

/**
 * Flujo para el proceso de cotización.
 * @param {string} sender Número de teléfono del cliente.
 * @param {string} message Mensaje del cliente.
 * @param {UserSession} sesionCliente Sesión actual del usuario.
 */
function cotizando(
  sender: string,
  message: string,
  sesionCliente: UserSession
) {
  console.log(
    `Flujo Cotizando, subpaso actual: ${sesionCliente.flujo.subpaso}`
  );

  if (!sesionCliente.flujo.subpaso || sesionCliente.flujo.subpaso === "") {
    sesionCliente.flujo.subpaso = "ingresando_datos_envio";
  }

  switch (sesionCliente.flujo.subpaso) {
    case "ingresando_datos_envio":
      const isValidFormat = parseData(message, sesionCliente);
      if (!isValidFormat) {
        sendMessage(
          sender,
          MENSAJE_FORMATO_INCORRECTO,
          "Formato de datos incorrecto"
        );
        // sendMessage(
        //   sender,
        //   MENSAJE_REINTENTAR_PLANTILLA,
        //   "Reenviando plantilla"
        // );
        // sendMessage(sender, FORMATO_DATOS_PLANTILLA, "Plantilla de datos");
        sendMessage(sender, MENSAJE_ENLACE_FORMULARIO, "Enlace al formulario");
        sesionCliente.flujo.subpaso = "ingresando_datos_envio"; // Stay in the same sub-step to retry data input
      } else {
        console.log(
          "Sesion cliente despues de parseData en Cotizando:",
          sesionCliente
        ); // LOG AÑADIDO
        cotizarSigylmex(sender, sesionCliente); // Obtener cotizaciones de Sigylmex
      }
      break;
    case "esperando_decision_compra_cotizacion":
      // **MODIFIED CASE - Now expecting tariff selection (number)**
      const opcionSeleccionadaCotizacion = parseInt(message.trim());
      if (
        !isNaN(opcionSeleccionadaCotizacion) &&
        opcionSeleccionadaCotizacion >= 1 &&
        opcionSeleccionadaCotizacion <=
          (sesionCliente.cotizacionSigylmex?.length || 0)
      ) {
        // User selected a tariff number after cotizaciones
        sesionCliente.flujo.paso = "compra"; // Transition to compra flow
        sesionCliente.flujo.subpaso = "esperando_seleccion_tarifa_compra"; // Set sub-step for tariff selection in compra
        seleccionarTarifaParaCompra(sender, message, sesionCliente); // Directly call seleccionarTarifaParaCompra to process the selection and payment
      } else {
        // If not a valid number, assume invalid option (could be improved with more specific error message if needed)
        sendMessage(
          sender,
          "Opción no válida. Por favor elige un número de tarifa de la lista.",
          "Opción no válida en selección de tarifa"
        );
      }
      break;
    case "mostrando_cotizaciones_sigylmex": // This case should not be reached in 'cotizar' flow after refactor, but kept for safety or future changes
      sendMessage(
        sender,
        "Error inesperado en el flujo de cotización.",
        "Error flujo cotización"
      );
      sesionCliente.flujo.subpaso = "";
      sesionCliente.flujo.paso = "";
      break;
    default:
      sendMessage(
        sender,
        "Lo siento, no entiendo tu mensaje en el flujo de cotización. Por favor intenta de nuevo.",
        "Mensaje no entendido - Cotización"
      );
      break;
  }
}

/**
 * Flujo para el mensaje de bienvenida inicial.
 * @param {string} sender Número de teléfono del cliente.
 * @param {UserSession} sesionCliente Sesión actual del usuario.
 * @param {string} incomingMessage Mensaje entrante del cliente.
 */
function bienvenida(
  sender: string,
  sesionCliente: UserSession,
  incomingMessage: string
) {
  console.log(
    `Flujo Bienvenida, subpaso actual: ${sesionCliente.flujo.subpaso}`
  );

  if (!sesionCliente.flujo.subpaso || sesionCliente.flujo.subpaso === "") {
    sesionCliente.flujo.subpaso = "enviando_bienvenida";
  }

  switch (sesionCliente.flujo.subpaso) {
    case "enviando_bienvenida":
      sendMessage(sender, MENSAJE_BIENVENIDA, "Mensaje de bienvenida enviado");
      sesionCliente.flujo.subpaso = "eligiendo_proceso_main";
      break;
    case "eligiendo_proceso_main":
      eligiendoProcesoMain(sender, incomingMessage, sesionCliente);
      break;
    default:
      sendMessage(
        sender,
        "Error en flujo de bienvenida.",
        "Error desconocido - Bienvenida"
      );
      sesionCliente.flujo.subpaso = "";
      sesionCliente.flujo.paso = "";
      break;
  }
}

/**
 * Función principal para procesar mensajes del chatbot y dirigir el flujo de conversación.
 * @param {string} cliente Número de teléfono del cliente.
 * @param {string} incomingMessage Mensaje entrante del cliente.
 */
export function processChatbotMessageLogic(
  cliente: string,
  incomingMessage: string
) {
  if (
    !chatbotSesionesDeUsuario[cliente] ||
    chatbotSesionesDeUsuario[cliente].flujo.paso === ""
  ) {
    console.log(`Iniciando nueva sesión para ${cliente}`);
    chatbotSesionesDeUsuario[cliente] = {
      flujo: { paso: "bienvenida", subpaso: "" },
    };
    chatbotSesionesDeUsuario[cliente].cotizacion = undefined;
    chatbotSesionesDeUsuario[cliente].cotizacionSigylmex = undefined; // Inicializar cotizaciones Sigylmex
    chatbotSesionesDeUsuario[cliente].envios = [];
    chatbotSesionesDeUsuario[cliente].remitente = undefined;
    chatbotSesionesDeUsuario[cliente].destinatario = undefined;
    chatbotSesionesDeUsuario[cliente].paquetes = [];
  }

  const sesionCliente = chatbotSesionesDeUsuario[cliente];
  console.log(
    `Mensaje recibido de ${cliente}: "${incomingMessage}", Flujo actual: ${sesionCliente.flujo.paso}, Subpaso: ${sesionCliente.flujo.subpaso}`
  );

  switch (sesionCliente.flujo.paso) {
    case "bienvenida":
      bienvenida(cliente, sesionCliente, incomingMessage);
      break;
    case "cotizar":
      cotizando(cliente, incomingMessage, sesionCliente);
      break;
    case "compra":
      comprando(cliente, incomingMessage, sesionCliente);
      break;
    default:
      sendMessage(
        cliente,
        "No entiendo tu mensaje en el flujo principal.",
        "Mensaje no entendido - Principal"
      );
      break;
  }
}
