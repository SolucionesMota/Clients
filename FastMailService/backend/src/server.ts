import bodyParser from 'body-parser';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { client, sandboxNumber } from '../config/twilio-config';
import { Person } from './types/types';

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

interface UserSession {
  paso: string;
  remitente?: Person;
  destinatario?: Person;
}

const sesionesDeUsuario: { [key: string]: UserSession } = {};

app.post('/chatbot', (req: Request, res: Response) => {
  const incomingMessage = req.body.Body;
  const cliente = req.body.From;

  console.log(`Mensaje recibido de ${cliente}: ${incomingMessage}`);

  if (!sesionesDeUsuario[cliente]) {
    sesionesDeUsuario[cliente] = { paso: 'bienvenida' };
  }
  //   sesionesDeUsuario[cliente].paso = 'creando_paquetes';

  const sesionCliente = sesionesDeUsuario[cliente];

  switch (sesionCliente.paso) {
    case 'bienvenida':
      bienvenida(cliente);
      sesionCliente.paso = 'eligiendo_servicio';
      break;

    case 'eligiendo_servicio':
      eligiendo_servicio(cliente, incomingMessage);
      break;

    case 'cotizar':
      cotizar(cliente, incomingMessage);
      return;

    case 'creando_remitente':
      crear_remitente(cliente, incomingMessage);
      break;
    case 'creando_paquetes':
      crear_paquetes(cliente, incomingMessage);
      break;
    case 'creando_destinatario':
      crear_destinatario(cliente, incomingMessage);
      break;
    default:
      sendErrorMessage(cliente);
      break;
  }

  res.status(200).send('Message processed');
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
    .then(message => console.log(`Mensaje de bienvenida enviado: ${message.sid}`))
    .catch(err => console.error('Error enviando mensaje de bienvenida:', err));
}

function eligiendo_servicio(sender: string, choice: string) {
  let responseMessage = '';

  switch (choice.toLowerCase()) {
    case '1':
    case 'comprar':
      responseMessage = "Great! Let's get started with your purchase. What would you like to buy?";
      break;

    case '2':
    case 'cotizar':
      cotizar(sender, choice);
      return;
    case '3':
    case 'soporte':
      responseMessage = 'Sure! How can we assist you? Please describe your issue.';
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
    .then(message => console.log(`Respuesta enviada: ${message.sid}`))
    .catch(err => console.error('Error al enviar respuesta:', err));
}

function cotizar(sender: string, message: string) {
  let responseMessage = '';

  if (message.toLowerCase() === '2' || message.toLowerCase() === 'cotizar') {
    responseMessage = `
    Para cotizar, necesitamos saber más detalles.
    Por favor, ingresa los datos del remitente separados por comas en el siguiente orden:
    Nombre, Calle, Código Postal, colonia, Ciudad, Estado`;

    client.messages
      .create({
        body: responseMessage,
        from: sandboxNumber,
        to: sender,
      })
      .then(message => {
        console.log(`Respuesta enviada: ${message.sid}`);

        // Actualizar el estado del usuario
        sesionesDeUsuario[sender].paso = 'creando_remitente';
      })
      .catch(err => console.error('Error al enviar respuesta:', err));
  }
}

function crear_remitente(sender: string, message: string) {
  const datos = message.split(',').map(dato => dato.trim());

  if (datos.length === 6) {
    const [nombre, calle, codigoPostal, colonia, ciudad, estado] = datos;
    const remitente: Person = { nombre, calle, codigoPostal, colonia, ciudad, estado };
    sesionesDeUsuario[sender].remitente = remitente;

    console.log('Datos del remitente recibidos:', {
      nombre,
      calle,
      codigoPostal,
      colonia,
      ciudad,
      estado,
    });
    emular_post_db_general('remitente', { nombre, calle, codigoPostal, colonia, ciudad, estado }, 'create');

    client.messages
      .create({
        body: `Ahora proporciona la siguiente información de tus paquetes en el siguiente orden.\n
        alto, ancho, largo, peso;\n
        Los datos deben incluir sus unidades cm y kg.\n
        Si es mas de un paquete, separa cada paquete con un punto y coma ";"\n
        EJEMPLO Dos paquetes:
        10cm, 15cm, 15cm, 0.5kg\n
        6.2cm, 12cm, 18.5cm, 5.3kg`,
        from: sandboxNumber,
        to: sender,
      })
      .then(message => console.log(`Datos recibidos: ${message.sid}`))
      .catch(err => console.error('Error enviando confirmación:', err));

    sesionesDeUsuario[sender].paso = 'creando_paquetes';
  } else {
    client.messages
      .create({
        body: `Los datos no están en el formato correcto. Por favor, ingresa los datos nuevamente siguiendo el orden indicado:
        Nombre, Calle, Código Postal, colonia, Ciudad, Estado`,
        from: sandboxNumber,
        to: sender,
      })
      .then(message => console.log(`Solicitando datos nuevamente: ${message.sid}`))
      .catch(err => console.error('Error solicitando datos nuevamente:', err));
  }
}

function crear_paquetes(sender: string, message: string) {
  if (message.includes(';')) {
    const paquetes = message.split(';').map(dato => dato.trim());
    console.log('paquetes', paquetes);
    let paquetesValidos = true; // Variable para verificar si todos los paquetes son válidos

    for (const paquete of paquetes) {
      if (!paquete.includes('kg')) {
        client.messages
          .create({
            body: `Por favor verifica los siguientes datos: ${paquete} y envía todos los paquetes de nuevo`,
            from: sandboxNumber,
            to: sender,
          })
          .then(message => {
            console.log(`Solicitando datos nuevamente: ${message.sid}`);
          })
          .catch(err => console.error('Error solicitando datos nuevamente:', err));
        paquetesValidos = false; // Si hay un paquete inválido, no se envía el mensaje de destinatario
      }
      if (validar_formato_paquete(paquete)) {
        emular_post_db_general(
          'paquetes',
          { remitente: JSON.stringify(sesionesDeUsuario[sender].remitente), paquete },
          'create'
        );
      }
    }

    // Solo enviar el mensaje de destinatario si todos los paquetes son válidos
    if (paquetesValidos) {
      client.messages
        .create({
          body: `Hemos recibido los siguientes paquetes: ${JSON.stringify(paquetes)}\n
          Por favor ingresa los datos del destinatario separados por comas en el siguiente orden:
          Nombre, Calle, Código Postal, colonia, Ciudad, Estado`,
          from: sandboxNumber,
          to: sender,
        })
        .then(message => {
          console.log(`Solicitando datos del destinatario: ${message.sid}`);
        });
      sesionesDeUsuario[sender].paso = 'creando_destinatario';
    }
  }
  if (!message.includes(';') && !message.includes('kg')) {
    client.messages
      .create({
        body: `Por favor verifica el formato\n
        EJEMPLO Dos paquetes:\n
        10cm, 15cm, 15cm, 0.5kg\n
        6.2cm, 12cm, 18.5cm, 5.3kg`,
        from: sandboxNumber,
        to: sender,
      })
      .then(message => console.log(`Solicitando datos nuevamente: ${message.sid}`))
      .catch(err => console.error('Error solicitando datos nuevamente:', err));
  }
}

function crear_destinatario(sender: string, message: string) {
  const datos = message.split(',').map(dato => dato.trim());
  if (datos.length != 6) {
    client.messages.create({
      body: `Los datos no están en el formato correcto. Por favor, ingresa los datos nuevamente siguiendo el orden indicado:
        Nombre, Calle, Código Postal, colonia, Ciudad, Estado`,
      from: sandboxNumber,
      to: sender,
    });
  }
  const [nombre, calle, codigoPostal, colonia, ciudad, estado] = datos;
  const destinatario: Person = { nombre, calle, codigoPostal, colonia, ciudad, estado };
  sesionesDeUsuario[sender].destinatario = destinatario;

  console.log('Datos del destinatario recibidos:', JSON.stringify(destinatario));
  emular_post_db_general('destinatario', destinatario, 'create');
}

// Funciones auxiliares
function sendErrorMessage(sender: string) {
  client.messages
    .create({
      body: 'Oops! Algo salió mal. Por favor intenta mas tarde.',
      from: sandboxNumber,
      to: sender,
    })
    .then(message => console.log(`Mensaje de error enviado: ${message.sid}`))
    .catch(err => console.error('Error enviando mensaje de error:', err));
}

function emular_post_db_general(some_entity_name: string, some_entity_data: any, action: string) {
  console.log('emulando accion', action, 'en', some_entity_name, 'con datos', some_entity_data);
  // New code to save data into a CSV file
  const filePath = path.join(__dirname, '../db', `${some_entity_name}.csv`);
  const data = Object.values(some_entity_data).join(',') + '\n'; // Convert object values to CSV format

  fs.appendFile(filePath, data, err => {
    if (err) {
      console.error(`Error guardando los datos en ${some_entity_name}.csv:`, err);
    } else {
      console.log(`Datos guardados en ${some_entity_name}.csv`);
    }
  });
}

function validar_formato_paquete(paquete: string) {
  const datos = paquete.split(',').map(dato => dato.replace(',', '').trim());
  return datos.length === 4;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
