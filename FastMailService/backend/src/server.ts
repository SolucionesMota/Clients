import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { client, sandboxNumber } from "../config/twilio-config";

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

interface UserSession {
  paso: string;
}

const sesionesDeUsuario: { [key: string]: UserSession } = {};

app.post("/webhook", (req: Request, res: Response) => {
  const incomingMessage = req.body.Body;
  const cliente = req.body.From;

  console.log(`Mensaje recibido de ${cliente}: ${incomingMessage}`);

  if (!sesionesDeUsuario[cliente]) {
    sesionesDeUsuario[cliente] = { paso: "bienvenida" };
  }

  const sesionCliente = sesionesDeUsuario[cliente];

  switch (sesionCliente.paso) {
    case "bienvenida":
      bienvenida(cliente);
      sesionCliente.paso = "eligiendo_servicio";
      break;

    case "eligiendo_servicio":
      eligiendo_servicio(cliente, incomingMessage);
      break;

    case "cotizar":
      cotizar(cliente, incomingMessage);
      break;

    case "creando_remitente":
      crear_remitente(cliente, incomingMessage);
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
    .then((message) =>
      console.log(`Mensaje de bienvenida enviado: ${message.sid}`)
    )
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
      cotizar(sender, choice);
      return;
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
    .then((message) => console.log(`Respuesta enviada: ${message.sid}`))
    .catch((err) => console.error("Error al enviar respuesta:", err));
}

function cotizar(sender: string, message: string) {
  let responseMessage = "";

  if (message.toLowerCase() === "2" || message.toLowerCase() === "cotizar") {
    responseMessage = `Para cotizar, necesitamos saber más detalles.
    Por favor, ingresa los datos del remitente separados por comas en el siguiente orden:
    Nombre, Calle, Código Postal, colonia, Ciudad, Estado`;

    client.messages
      .create({
        body: responseMessage,
        from: sandboxNumber,
        to: sender,
      })
      .then((message) => {
        console.log(`Respuesta enviada: ${message.sid}`);

        // Actualizar el estado del usuario
        sesionesDeUsuario[sender].paso = "creando_remitente";
      })
      .catch((err) => console.error("Error al enviar respuesta:", err));
  }
}

function crear_remitente(sender: string, message: string) {
  const datos = message.split(",").map((dato) => dato.trim());

  if (datos.length === 6) {
    const [nombre, calle, codigoPostal, colonia, ciudad, estado] = datos;

    console.log("Datos del remitente recibidos:", {
      nombre,
      calle,
      codigoPostal,
      colonia,
      ciudad,
      estado,
    });
    emular_post_db({ nombre, calle, codigoPostal, colonia, ciudad, estado });

    client.messages
      .create({
        body: `Datos recibidos`,
        from: sandboxNumber,
        to: sender,
      })
      .then((message) => console.log(`Confirmación enviada: ${message.sid}`))
      .catch((err) => console.error("Error enviando confirmación:", err));

    sesionesDeUsuario[sender].paso = "bienvenida";
  } else {
    client.messages
      .create({
        body: `Los datos no están en el formato correcto. Por favor, ingresa los datos nuevamente siguiendo el orden indicado:
        Nombre, Calle, Código Postal, colonia, Ciudad, Estado`,
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

function sendErrorMessage(sender: string) {
  client.messages
    .create({
      body: "Oops! Algo salió mal. Por favor intenta mas tarde.",
      from: sandboxNumber,
      to: sender,
    })
    .then((message) => console.log(`Mensaje de error enviado: ${message.sid}`))
    .catch((err) => console.error("Error enviando mensaje de error:", err));
}

function emular_post_db(remitente: {
  nombre: string;
  calle: string;
  codigoPostal: string;
  colonia: string;
  ciudad: string;
  estado: string;
}) {
  console.log("Guardando datos del remitente en la base de datos:", remitente);
  const filePath = path.join(__dirname, "../db/remitente_table.csv");
  const data = `${remitente.nombre},${remitente.calle},${remitente.codigoPostal},${remitente.colonia},${remitente.ciudad},${remitente.estado}\n`;

  fs.appendFile(filePath, data, (err) => {
    if (err) {
      console.error("Error guardando los datos en remitente_table.csv:", err);
    } else {
      console.log("Datos guardados en remitente_table.csv");
    }
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
