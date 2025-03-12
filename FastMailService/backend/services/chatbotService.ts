import { client, sandboxNumber } from "../config/twilio-config";
import {
  TarifaNacional_10_30,
  TarifaNacional_8_30,
  TarifaNacional_Dia_Siguiente,
  TarifaNacional_Economico,
  ZonasDeEnvio,
  ZonasZipCodeMap,
} from "../db/ZonasZipCode";
import { fetchStripeData } from "../integrations/stripe/stripe";
import { Checkout_Session } from "../integrations/stripe/stripe-types";
import { UserSession, ZipCodeRange } from "../types/types";
const chatbotSesionesDeUsuario: { [key: string]: UserSession } = {};

const formatoDatos = `
        *Remitente*
        *Nombre completo o razón social*:
        *Dirección*:Calle,Colonia,Código Postal,Ciudad,Estado
        *Celular*:
        *Correo electrónico*:
        
        *Destinatario*
        *Nombre completo o razón social*:
        *Dirección*:Calle,Colonia,Código Postal,Ciudad,Estado
        
        *Paquete*
        *Alto*:
        *Ancho*:
        *Largo*:
        *Peso*:
    `;
const mensajeBienvenida = `¡Hola! 😊 ¿Cómo puedo ayudarte hoy? Por favor elige una de las siguientes opciones:
  1. *Comprar* - Comprar una guía.
  2. *Cotizar* - Cotizar una guía.
  3. *Soporte* -   Contactar a soporte.`;

const procesoEnDesarrolloAlertMessage =
  "Este proceso está en desarrollo, por favor espere a que se habilite";

const mensajeElegirTarifa = `Si quieres comprar elige la tarifa que deseas:
1. Tarifa 8:30
2. Tarifa 10:30
3. Tarifa Dia siguiente
4. Tarifa Economica`;

const mensajeDePago = `Le compartimos nuestros Métodos de pago ✅💲
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

const mensajeDePagoExitoso = `¡Gracias! Tu compra ha sido realizada con éxito.`;

//Bienvenida

function eligiendoProcesoMain(
  sender: string,
  choice: string,
  sesionCliente: UserSession
) {
  sesionCliente.flujo.subpaso = "";
  switch (choice.toLowerCase()) {
    case "1":
    case "comprar":
      if (!sesionCliente.cotizacion) {
        sesionCliente.flujo.paso = "compra";
        sesionCliente.flujo.subpaso = "";
        sendMessage(
          sender,
          "Por favor copia y pega la plantilla para llenarla o si prefieres puedes llenar el siguiente formulario https://whatsform.com/Up1kEP",
          "Instrucciones del uso de plantilla"
        );
        sendMessage(sender, formatoDatos, "solicitando datos de envío");
      } else {
        sendMessage(
          sender,
          "Ya tienes una compra en proceso",
          "Proceso compra"
        );
        console.log(sesionCliente.cotizacion);
      }
      break;
    case "2":
    case "cotizar":
      sesionCliente.flujo.paso = "cotizar";
      sesionCliente.flujo.subpaso = "";
      sendMessage(
        sender,
        "Por favor copia y pega la plantilla para llenarla o si prefieres puedes llenar el siguiente formulario https://whatsform.com/Up1kEP",
        "Instrucciones del uso de plantilla"
      );
      sendMessage(sender, formatoDatos, "solicitando datos de envío");
      break;
    case "3":
    case "soporte":
      sesionCliente.flujo.paso = "";
      sendMessage(sender, procesoEnDesarrolloAlertMessage, "Proceso soporte");
      break;
    default:
      return "Sorry, I didn't understand that. Please choose one of the following options:\n1. Comprar\n2. Cotizar\n3. Soporte";
  }
  // sendMessage(sender, responseMessage, "Respuesta enviada");
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

function parseData(message: string, sesionCliente: UserSession) {
  const lines = message
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  let currentSection: "remitente" | "destinatario" | "paquete" | null = null;
  let remitenteData: Record<string, string> = {};
  let destinatarioData: Record<string, string> = {};
  let paqueteData: Record<string, string> = {};

  lines.forEach((line) => {
    if (line === "Remitente") {
      currentSection = "remitente";
      return;
    }
    if (line === "Destinatario") {
      currentSection = "destinatario";
      return;
    }
    if (line === "Paquete") {
      currentSection = "paquete";
      return;
    }

    const parts = line.split(":");
    if (parts.length > 1) {
      const key = parts[0].trim();
      const value = parts.slice(1).join(":").trim(); // Unir valores si hay ":" en la dirección

      if (currentSection === "remitente") {
        remitenteData[key] = value;
      } else if (currentSection === "destinatario") {
        destinatarioData[key] = value;
      } else if (currentSection === "paquete") {
        paqueteData[key] = value;
      }
    }
  });

  // **Remitente**
  sesionCliente.remitente = {
    nombre: remitenteData["Nombre completo o razón social"] || "",
    direccion: parseDireccion(remitenteData["Dirección"]),
    celular: remitenteData["Celular"] || "",
    correo: remitenteData["Correo electrónico"] || "",
  };

  // **Destinatario**
  sesionCliente.destinatario = {
    nombre: destinatarioData["Nombre completo o razón social"] || "",
    direccion: parseDireccion(destinatarioData["Dirección"]),
    celular: destinatarioData["Celular"] || "",
    correo: destinatarioData["Correo electrónico"] || "",
  };

  // **Paquete**
  sesionCliente.paquetes = [
    {
      alto: parseFloat(paqueteData["Alto"] || "0"),
      ancho: parseFloat(paqueteData["Ancho"] || "0"),
      largo: parseFloat(paqueteData["Largo"] || "0"),
      peso: parseFloat(paqueteData["Peso"] || "0"),
      costo: 0, // Se puede calcular después
    },
  ];
}

function parseDireccion(direccionStr: string | undefined) {
  if (!direccionStr) {
    return { calle: "", colonia: "", codigoPostal: "", ciudad: "", estado: "" };
  }

  const parts = direccionStr.split(",");
  return {
    calle: parts[0]?.trim() || "",
    codigoPostal: parts[1]?.trim() || "",
    colonia: parts[2]?.trim() || "",
    ciudad: parts[3]?.trim() || "",
    estado: parts[4]?.trim() || "",
  };
}

function calcularCostos(sender: string, sesionCliente: UserSession) {
  const remitente = sesionCliente.remitente;
  const destinatario = sesionCliente.destinatario;
  const paquetes = sesionCliente.paquetes;

  const estado_remitente = limpiarEstado(`${remitente?.direccion.estado}`);
  const estado_destinatario = limpiarEstado(
    `${destinatario?.direccion.estado}`
  );
  console.log("estado_remitente", estado_remitente);
  console.log("estado_destinatario", estado_destinatario);

  const ZonaZipCodeRemitente: ZipCodeRange[] | undefined = ZonasZipCodeMap.get(
    `${estado_remitente}`
  )?.filter(
    (zona: { zipcode_start: string; zipcode_end: string }) =>
      Number(zona.zipcode_start) <= Number(remitente?.direccion.codigoPostal) &&
      Number(zona.zipcode_end) >= Number(remitente?.direccion.codigoPostal)
  );

  const ZonaZipCodeDestinatario: ZipCodeRange[] | undefined =
    ZonasZipCodeMap.get(`${estado_destinatario}`)?.filter(
      (zona: { zipcode_start: string; zipcode_end: string }) =>
        Number(zona.zipcode_start) <=
          Number(destinatario?.direccion.codigoPostal) &&
        Number(zona.zipcode_end) >= Number(destinatario?.direccion.codigoPostal)
    );

  console.log("ZonaZipCodeRemitente", ZonaZipCodeRemitente);
  console.log("ZonaZipCodeDestinatario", ZonaZipCodeDestinatario);

  const groupRemitente = ZonaZipCodeRemitente?.[0]?.group;
  const groupDestinatario = ZonaZipCodeDestinatario?.[0]?.group;

  console.log("groupRemitente", groupRemitente);
  console.log("groupDestinatario", groupDestinatario);

  let ZonaEnvio =
    groupRemitente && groupDestinatario
      ? ZonasDeEnvio[groupRemitente][groupDestinatario]
      : undefined;

  console.log("ZonaEnvio", ZonaEnvio);

  if (ZonaEnvio === groupRemitente) {
    ZonaEnvio = ZonaEnvio?.replace("*", "");
  }

  if (!ZonaEnvio) {
    sendMessage(
      sender,
      "Lo sentimos, no podemos calcular costos para esta ruta de envío",
      "Error en cálculo de costos"
    );
    sesionCliente.flujo.subpaso = "";
    return;
  }

  let mensaje_tarifas_disponibles = `Tenemos las siguientes tarifas disponibles, elige una:\n`;

  for (let paquete of paquetes!) {
    const peso = Math.ceil(paquete.peso);
    const costo_fedex_8_30 =
      TarifaNacional_8_30.Paquetes[peso][Number(ZonaEnvio)];
    const costo_fedex_10_30 =
      TarifaNacional_10_30.Paquetes[peso][Number(ZonaEnvio)];
    const costo_fedex_dia_siguiente =
      TarifaNacional_Dia_Siguiente.Paquetes[peso][Number(ZonaEnvio)];
    const costo_fedex_economico =
      TarifaNacional_Economico.Paquetes[peso][Number(ZonaEnvio)];
    mensaje_tarifas_disponibles += `1. 8:30: ${costo_fedex_8_30}\n`;
    mensaje_tarifas_disponibles += `2. 10:30: ${costo_fedex_10_30}\n`;
    mensaje_tarifas_disponibles += `3. Dia siguiente: ${costo_fedex_dia_siguiente}\n`;
    mensaje_tarifas_disponibles += `4. Economica: ${costo_fedex_economico}\n`;

    sesionCliente.cotizacion = {
      costo_fedex_8_30: costo_fedex_8_30,
      costo_fedex_10_30: costo_fedex_10_30,
      costo_fedex_dia_siguiente: costo_fedex_dia_siguiente,
      costo_fedex_economico: costo_fedex_economico,
    };
  }

  sendMessage(sender, mensaje_tarifas_disponibles, "Costo de envío");
}

function esCompra(sender: string, message: string, sesionCliente: UserSession) {
  const tarifaElegida = message;
  switch (tarifaElegida) {
    case "8:30":
    case "1":
      console.log("tarifa 8:30");
      sesionCliente.flujo.paso = "compra";
      sesionCliente.flujo.subpaso = "esperando_confirmacion_pago";
      sesionCliente.envios?.push({
        remitente: sesionCliente.remitente!,
        destinatario: sesionCliente.destinatario!,
        paquetes: sesionCliente.paquetes!,
        tarifa: TarifaNacional_8_30,
        fechaEnvio: new Date(),
        fechaEntrega: new Date(),
        estado: "prospecto",
        _id: "1",
        checkout_session_id: "",
        costo: sesionCliente.cotizacion?.costo_fedex_8_30 ?? 0,
      });
      sendMessage(sender, mensajeDePago, "Mensaje eleccion pago");
      break;
    case "10:30":
    case "2":
      console.log("tarifa 10:30");
      sesionCliente.flujo.paso = "compra";
      sesionCliente.flujo.subpaso = "esperando_confirmacion_pago";
      sesionCliente.envios?.push({
        remitente: sesionCliente.remitente!,
        destinatario: sesionCliente.destinatario!,
        paquetes: sesionCliente.paquetes!,
        tarifa: TarifaNacional_10_30,
        fechaEnvio: new Date(),
        fechaEntrega: new Date(),
        estado: "prospecto",
        _id: "1",
        checkout_session_id: "",
        costo: sesionCliente.cotizacion?.costo_fedex_10_30 ?? 0,
      });
      sendMessage(sender, mensajeDePago, "Mensaje eleccion pago");
      break;
    case "Dia siguiente":
    case "3":
      console.log("tarifa Dia siguiente");
      sesionCliente.flujo.paso = "compra";
      sesionCliente.flujo.subpaso = "esperando_confirmacion_pago";
      sesionCliente.envios?.push({
        remitente: sesionCliente.remitente!,
        destinatario: sesionCliente.destinatario!,
        paquetes: sesionCliente.paquetes!,
        tarifa: TarifaNacional_Dia_Siguiente,
        fechaEnvio: new Date(),
        fechaEntrega: new Date(),
        estado: "prospecto",
        _id: "1",
        checkout_session_id: "",
        costo: sesionCliente.cotizacion?.costo_fedex_dia_siguiente ?? 0,
      });
      sendMessage(sender, mensajeDePago, "Mensaje eleccion pago");
      break;
    case "Economica":
    case "4":
      console.log("tarifa Economica");
      sesionCliente.flujo.paso = "compra";
      sesionCliente.flujo.subpaso = "esperando_confirmacion_pago";
      sesionCliente.envios?.push({
        remitente: sesionCliente.remitente!,
        destinatario: sesionCliente.destinatario!,
        paquetes: sesionCliente.paquetes!,
        tarifa: TarifaNacional_Economico,
        fechaEnvio: new Date(),
        fechaEntrega: new Date(),
        estado: "prospecto",
        _id: "1",
        checkout_session_id: "",
        costo: sesionCliente.cotizacion?.costo_fedex_economico ?? 0,
      });
      sendMessage(sender, mensajeDePago, "Mensaje eleccion pago");
      break;
    case "cancelar":
    case "5":
      console.log("envio cancelado");
      sesionCliente.flujo.subpaso = "";
      sesionCliente.flujo.paso = "";
      sendMessage(sender, "Envio cancelado", "Envio cancelado");
      break;
    default:
      console.log("tarifa no válida o envio cancelado");
      sesionCliente.flujo.subpaso = "";
      sesionCliente.flujo.paso = "";
      sendMessage(
        sender,
        mensajeElegirTarifa,
        "mensaje de elección de tarifa enviado"
      );
      break;
  }
}

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

  const checkout_sessions: Checkout_Session[] = (
    await fetchStripeData("checkout/sessions")
  ).data;
  const most_recent_checkout_session = checkout_sessions[0];
  const checkout_celular = most_recent_checkout_session.customer_details.phone;
  const checkout_nombre = most_recent_checkout_session.customer_details.name;
  const checkout_monto = most_recent_checkout_session.amount_total;

  if (checkout_celular === envio_remitente_celular) {
    if (checkout_monto < envio_monto) {
      sendMessage(
        sender,
        "El pago no correcto, ponte en contacto con soporte",
        "Pago incorrecto"
      );
    } else {
      sendMessage(
        sender,
        "El pago es correcto. Procederemos a generar la guia de envío",
        "Pago correcto"
      );
    }
    sesionCliente.flujo.subpaso = "";
    sesionCliente.flujo.paso = "";
  } else {
    sendMessage(
      sender,
      "el último pago registrado no corresponde al remitente, ponte en contacto con soporte",
      "Pago incorrecto"
    );
    sesionCliente.flujo.subpaso = "";
    sesionCliente.flujo.paso = "";
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

// function crear_remitente(sender: string, message: string) {
//   const datos = message.split(",").map((dato) => dato.trim());

//   if (datos.length === 6) {
//     const direccion: Direccion = {
//       calle: datos[1],
//       colonia: datos[2],
//       codigoPostal: datos[3],
//       ciudad: datos[4],
//       estado: datos[5],
//     };
//     const remitente: Cliente = {
//       nombre,
//       direccion,
//       celular: sender.split(":")[1],
//     };
//     chatbotSesionesDeUsuario[sender].remitente = remitente;

//     console.log("Datos del remitente recibidos:", remitente);
//     emular_post("remitente", remitente);

//     sendMessage(
//       sender,
//       "Por favor, ingresa los datos del destinatario separados por comas en el siguiente orden: Nombre, Calle, Código Postal, colonia, Ciudad, Estado",
//       "Solicitando datos del destinatario"
//     );
//   } else {
//     const errorMessage = `Los datos del remitente no están en el formato correcto. Por favor, ingresa los datos nuevamente siguiendo el orden indicado:
//       Nombre, Calle, Código Postal, colonia, Ciudad, Estado`;
//     sendMessage(sender, errorMessage, "Error al solicitar datos del remitente");
//   }
// }

// //Sub pasos cotizar
// function crear_destinatario(sender: string, message: string) {
//   const datos = message.split(",").map((dato) => dato.trim());
//   if (datos.length != 6) {
//     const errorMessage = `Los datos del destinatario no están en el formato correcto. Por favor, ingresa los datos nuevamente siguiendo el orden indicado:
//       Nombre, Calle, Código Postal, colonia, Ciudad, Estado`;
//     sendMessage(
//       sender,
//       errorMessage,
//       "Error al solicitar datos del destinatario"
//     );
//   } else {
//     const [nombre, calle, codigoPostal, colonia, ciudad, estado] = datos;
//     const destinatario: Cliente = {
//       nombre,
//       calle,
//       codigoPostal,
//       colonia,
//       ciudad,
//       estado,
//       celular: sender.split(":")[1],
//     };
//     chatbotSesionesDeUsuario[sender].destinatario = destinatario;

//     console.log("Datos del destinatario recibidos:", destinatario);
//     emular_post("destinatario", destinatario);

//     sendMessage(
//       sender,
//       'Ahora proporciona la siguiente información de tus paquetes en el siguiente orden. Alto, ancho, largo, peso. Los datos deben incluir sus unidades cm y kg. Para darte una cotización adecuada por favor proporciona las dimensiones y peso exactos. De lo contrario solo podemos proporcionar una aproximación del costo y éste puede ser actualizado cuando visites la sucursal. Si es más de un paquete, separa cada paquete con un punto y coma ";". EJEMPLO Dos paquetes: 10cm, 15cm, 15cm, 0.5kg; 6.2cm, 12cm, 18.5cm, 5.3kg',
//       "Solicitando información de paquetes"
//     );
//   }
// }

// function crear_paquetes(sender: string, message: string) {
//   const sesionCliente = chatbotSesionesDeUsuario[sender];

//   const paquetes = parsePackages(message);
//   console.log("Paquetes recibidos:", paquetes);

//   if (validatePackages(paquetes)) {
//     storePackagesInSession(paquetes, sesionCliente);
//     sendPackageConfirmation(paquetes, sender);
//   } else {
//     requestPackageResend(sender);
//   }
// }

// function parsePackages(message: string): string[] {
//   return message.includes(";")
//     ? message.split(";").map((dato) => dato.trim())
//     : [message.trim()];
// }

// function validatePackages(paquetes: string[]): boolean {
//   return true;
// }

// function storePackagesInSession(
//   paquetes: string[],
//   sesionCliente: UserSession
// ) {
//   guardarPaquetesEnSesion(paquetes, sesionCliente);
// }

// function sendPackageConfirmation(paquetes: string[], sender: string) {
//   enviarConfirmacionPaquetes(paquetes, sender);
// }

// function requestPackageResend(sender: string) {
//   solicitarReenvioPaquetes(sender);
// }

// function crear_envio(sender: string, message: string) {
//   const sesionCliente = chatbotSesionesDeUsuario[sender];
//   const envios: Envio[] = [];
//   const paquetes: Paquete[] | undefined = sesionCliente.paquetes;
//   const remitente = sesionCliente?.remitente;
//   const destinatario = sesionCliente?.destinatario;

//   if (!paquetes) {
//     console.log("No hay paquetes en la sesión");
//     sendMessage(
//       sender,
//       "No hay paquetes en la sesión",
//       "No hay paquetes en la sesión"
//     );
//     return;
//   }
//   if (!remitente) {
//     console.log("No hay remitente en la sesión");
//     sendMessage(
//       sender,
//       "No hay remitente en la sesión",
//       "No hay remitente en la sesión"
//     );
//     return;
//   }
//   if (!destinatario) {
//     console.log("No hay destinatario en la sesión");
//     sendMessage(
//       sender,
//       "No hay destinatario en la sesión",
//       "No hay destinatario en la sesión"
//     );
//     return;
//   }

//   // for (const paquete of paquetes) {
//   let envio: Envio = {} as Envio;
//   envio.remitente = remitente;
//   envio.destinatario = destinatario;
//   envio.paquetes = paquetes;
//   envio.tarifa = TarifaNacional_8_30;
//   envio.fechaEnvio = new Date();
//   envio.fechaEntrega = new Date();
//   envio.estado = "prospecto";
//   envio._id = "1";
//   console.log("Envio creado:", envio);
//   emular_post("envios", envio);
//   sesionCliente.ultimo_envio = envio;
//   envios.push(envio);
//   sesionCliente.envios = envios;
//   // }

//   // Convertir los envíos a JSON para imprimirlos de manera legible
// }

// function guardarPaquetesEnSesion(
//   paquetes: string[],
//   sesionCliente: UserSession
// ) {
//   // for (const paquete of paquetes) {
//   //   emular_post_db_general(
//   //     "paquetes",
//   //     {
//   //       // remitente: JSON.stringify(sesionCliente.remitente),
//   //       paquete,
//   //     },
//   //     "create"
//   //   );
//   // }
//   sesionCliente.paquetes = paquetes.map((paquete) => {
//     const [alto, ancho, largo, peso] = paquete
//       .split(",")
//       .map((dato) =>
//         parseFloat(dato.replace("cm", "").replace("kg", "").trim())
//       );

//     return { alto, ancho, largo, peso } as Paquete;
//   });
// }

// function calcular_costos(sender: string) {
//   const sesionCliente = chatbotSesionesDeUsuario[sender];
//   if (!sesionCliente.paquetes) {
//     console.log("No hay paquetes en la sesión");
//     sendMessage(
//       sender,
//       "No hay paquetes en la sesión",
//       "No hay paquetes en la sesión"
//     );
//     return;
//   }

//   const paquetes = sesionCliente.paquetes;
//   const remitente = sesionCliente.remitente;
//   const destinatario = sesionCliente.destinatario;

//   if (!remitente || !destinatario) {
//     console.log("Faltan datos de remitente o destinatario");
//     sendMessage(
//       sender,
//       "Faltan datos de remitente o destinatario",
//       "Error en cálculo de costos"
//     );
//     return;
//   }

//   const estado_remitente = limpiarEstado(`${remitente.estado}`);
//   const estado_destinatario = limpiarEstado(`${destinatario.estado}`);

//   console.log("Estado del remitente:", estado_remitente);
//   console.log("Estado del destinatario:", estado_destinatario);

//   const ZonaZipCodeRemitente: ZipCodeRange[] | undefined = ZonasZipCodeMap.get(
//     `${estado_remitente}`
//   )?.filter(
//     (zona) =>
//       Number(zona.zipcode_start) <= Number(remitente.codigoPostal) &&
//       Number(zona.zipcode_end) >= Number(remitente.codigoPostal)
//   );

//   const ZonaZipCodeDestinatario: ZipCodeRange[] | undefined =
//     ZonasZipCodeMap.get(`${estado_destinatario}`)?.filter(
//       (zona) =>
//         Number(zona.zipcode_start) <= Number(destinatario.codigoPostal) &&
//         Number(zona.zipcode_end) >= Number(destinatario.codigoPostal)
//     );

//   if (!ZonaZipCodeRemitente || !ZonaZipCodeDestinatario) {
//     console.log(
//       "No se encontraron zonas para los códigos postales proporcionados"
//     );
//     sendMessage(
//       sender,
//       "Lo sentimos, no podemos calcular costos para las ubicaciones proporcionadas",
//       "Error en cálculo de costos"
//     );
//     return;
//   }

//   const groupRemitente: string = ZonaZipCodeRemitente[0].group;
//   const groupDestinatario: string = ZonaZipCodeDestinatario[0].group;
//   console.log("Grupo del remitente:", groupRemitente);
//   console.log("Grupo del destinatario:", groupDestinatario);

//   let ZonaEnvio: string | undefined =
//     ZonasDeEnvio[groupRemitente]?.[groupDestinatario];

//   if (groupRemitente === groupDestinatario) {
//     console.log(
//       "Esta tarifa no aplica para todas las ciudades, quieres ser redirigido para atención?"
//     );
//     ZonaEnvio = ZonaEnvio?.replace("*", "");
//   }

//   if (!ZonaEnvio) {
//     sendMessage(
//       sender,
//       "Lo sentimos, no podemos calcular costos para esta ruta de envío",
//       "Error en cálculo de costos"
//     );
//     return;
//   }

//   let mensaje_costo = `Los paquetes tienen un costo de envío de:\n`;

//   for (let paquete of paquetes) {
//     const peso = Math.ceil(paquete.peso);
//     const costo_fedex_8_30 =
//       TarifaNacional_8_30.Paquetes[peso][Number(ZonaEnvio)];
//     const costo_fedex_10_30 =
//       TarifaNacional_10_30.Paquetes[peso][Number(ZonaEnvio)];
//     const costo_fedex_economico =
//       TarifaNacional_Economico.Paquetes[peso][Number(ZonaEnvio)];
//     const costo_fedex_dia_siguiente =
//       TarifaNacional_Dia_Siguiente.Paquetes[peso][Number(ZonaEnvio)];

//     mensaje_costo += `Paquete (${paquete.alto}x${paquete.ancho}x${paquete.largo}cm, ${paquete.peso}kg):\n`;
//     mensaje_costo += `- Fedex 8:30: $${costo_fedex_8_30}\n`;
//     mensaje_costo += `- Fedex 10:30: $${costo_fedex_10_30}\n`;
//     mensaje_costo += `- Fedex económico: $${costo_fedex_economico}\n`;
//     mensaje_costo += `- Fedex día siguiente: $${costo_fedex_dia_siguiente}\n\n`;
//   }

//   mensaje_costo +=
//     "\nPor favor, elige una de las tarifas disponibles respondiendo con el nombre del servicio.";

//   sendMessage(sender, mensaje_costo, "Mensaje de costo enviado");
// }

// //Mensajes
// function enviarConfirmacionPaquetes(paquetes: string[], sender: string) {
//   sendMessage(
//     sender,
//     `Hemos recibido los siguientes paquetes: ${JSON.stringify(
//       paquetes
//     )}\n. Estos son las tarifas dispónibles para el envío. Por favor elige la que mas te convenga`,
//     "Confirmación de paquetes enviados"
//   );
// }

// function solicitarReenvioPaquetes(sender: string) {
//   sendMessage(
//     sender,
//     `Por favor, verifica el formato de los paquetes y envíalos nuevamente.\n
//     Ejemplo de formato:\n
//     10cm, 15cm, 15cm, 0.5kg\n
//     6.2cm, 12cm, 18.5cm, 5.3kg`,
//     "Solicitando reenvío de paquetes"
//   );
// }

// function emular_post(nombreObjeto: string, datos: any) {
//   const filePath = path.join(__dirname, `${nombreObjeto}.csv`);
//   const csvData = Object.values(datos).join(",") + "\n";

//   fs.appendFile(filePath, csvData, (err) => {
//     if (err) {
//       console.error(`Error writing to ${nombreObjeto}.csv:`, err);
//     } else {
//       console.log(`Data appended to ${nombreObjeto}.csv`);
//     }
//   });
// }

async function getNormalizedNumber(phoneNumber: string) {
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

//Cotizando

function comprando(
  sender: string,
  message: string,
  sesionCliente: UserSession
) {
  console.log(`Flujo Comprando`);
  if (!sesionCliente.flujo.subpaso || sesionCliente.flujo.subpaso === "") {
    sesionCliente.flujo.subpaso = "calculando_costos";
  }
  const flujo = sesionCliente.flujo;

  switch (flujo.subpaso) {
    case "calculando_costos":
      parseData(message, sesionCliente);
      calcularCostos(sender, sesionCliente);
      sesionCliente.flujo.subpaso = "es_compra";
      break;
    case "es_compra":
      esCompra(sender, message, sesionCliente);
      console.log(sesionCliente.cotizacion);
      break;
    case "esperando_confirmacion_pago":
      confirmarPago(sender, message, sesionCliente);
      break;
    default:
      sendMessage(sender, "No entiendo tu mensaje", "Mensaje no entendido");
      break;
  }
}

function cotizando(
  sender: string,
  message: string,
  sesionCliente: UserSession
) {
  console.log(`Flujo Cotizando`);

  if (!sesionCliente.flujo.subpaso || sesionCliente.flujo.subpaso === "") {
    sesionCliente.flujo.subpaso = "calculando_costos";
  }
  const flujo = sesionCliente.flujo;

  switch (flujo.subpaso) {
    case "calculando_costos":
      parseData(message, sesionCliente);
      calcularCostos(sender, sesionCliente);
      sesionCliente.flujo.subpaso = "es_compra";
      break;
    case "es_compra":
      esCompra(sender, message, sesionCliente);
      // console.log(sesionCliente.cotizacion);
      break;
    case "esperando_confirmacion_pago":
      confirmarPago(sender, message, sesionCliente);
      break;
    default:
      sendMessage(
        sender,
        "Lo siento, no entiendo tu mensaje. Por favor intenta de nuevo.",
        "Mensaje no entendido"
      );
      break;
  }
}

function bienvenida(
  sender: string,
  sesionCliente: UserSession,
  incomingMessage: string
) {
  if (!sesionCliente.flujo.subpaso || sesionCliente.flujo.subpaso === "") {
    sesionCliente.flujo.subpaso = "enviando_bienvenida";
  }

  switch (sesionCliente.flujo.subpaso) {
    case "enviando_bienvenida":
      sendMessage(sender, mensajeBienvenida, "Mensaje de bienvenida enviado");
      sesionCliente.flujo.subpaso = "eligiendo_proceso_main";
      break;
    case "eligiendo_proceso_main":
      eligiendoProcesoMain(sender, incomingMessage, sesionCliente);
      break;
    default:
      sendMessage(
        sender,
        "fin de switch flujo.subpaso en bienvenida",
        "Mensaje de bienvenida enviado"
      );
      sesionCliente.flujo.subpaso = "";
      sesionCliente.flujo.paso = "";
      break;
  }
}

export function processChatbotMessageLogic(
  cliente: string,
  incomingMessage: string
) {
  if (
    !chatbotSesionesDeUsuario[cliente] ||
    chatbotSesionesDeUsuario[cliente].flujo.paso === ""
  ) {
    chatbotSesionesDeUsuario[cliente] = { flujo: { paso: "bienvenida" } };
    chatbotSesionesDeUsuario[cliente].cotizacion = undefined;
    chatbotSesionesDeUsuario[cliente].envios = [];
    chatbotSesionesDeUsuario[cliente].remitente = undefined;
    chatbotSesionesDeUsuario[cliente].destinatario = undefined;
    chatbotSesionesDeUsuario[cliente].paquetes = [];
  }

  const sesionCliente = chatbotSesionesDeUsuario[cliente];

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
      sendMessage(cliente, "No entiendo tu mensaje", "Mensaje no entendido");
      break;
  }
}
