import bcrypt from "bcrypt";
import { Request, Response } from "express";
import session from "express-session";
import app from "./app";
import {
  createDataInCouchDB,
  deleteDataFromCouchDB,
  fetchDataFromCouchDB,
} from "./db/couchdb";
import { Cliente, Envio, UserSession } from "./types/types";

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

//remitentes
app.get("/remitentes", async (req, res) => {
  try {
    const data: Cliente[] | undefined = await fetchDataFromCouchDB(
      "remitentes"
    );
    let remitentes: Cliente[] = [];
    if (!data) {
      res.status(404).send("No hay remitentes");
      return;
    }
    for (let remitente of data) {
      remitentes.push(remitente);
    }
    res.status(200).json(remitentes);
  } catch (error) {
    console.error("Error al obtener remitentes:", error);
    res.status(500).send("Error al obtener remitentes");
  }
});

app.get("/remitentes/:id", async (req, res) => {
  const id = req.params.id;
  const data: Cliente | undefined = await fetchDataFromCouchDB(
    "remitentes",
    id
  );
  if (!data) {
    res.status(404).send("No hay remitente con ese id");
    return;
  }
  res.status(200).json(data);
});

app.post("/remitentes/", async (req, res) => {
  const remitente: Cliente = req.body;
  const response = await createDataInCouchDB("remitentes", remitente);
  res.status(200).json(response);
});

app.delete("/remitentes/:id", async (req, res) => {
  const id = req.params.id;
  const response = await deleteDataFromCouchDB("remitentes", id);
  res.status(200).json(response);
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
  if (!chatbotSesionesDeUsuario[cliente].ultimo_envio) {
    chatbotSesionesDeUsuario[cliente].ultimo_envio = {} as Envio;
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
