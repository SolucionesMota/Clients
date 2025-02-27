import bcrypt from "bcrypt";
import { Request, Response } from "express";

const users: { username: string; password: string }[] = [];

export async function register(req: Request, res: Response) {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ username, password: hashedPassword });
  res.status(201).send("Usuario registrado");
}

export async function login(req: Request, res: Response) {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username);
  if (user && (await bcrypt.compare(password, user.password))) {
    (req.session as any).userId = user.username;
    res.send("Inicio de sesión exitoso");
  } else {
    res.status(401).send("Credenciales incorrectas");
  }
}

export function logout(req: Request, res: Response) {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Error al cerrar sesión");
    }
    res.send("Sesión cerrada");
  });
}
