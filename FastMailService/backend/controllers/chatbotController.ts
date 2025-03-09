import { Request, Response } from "express";
import { processChatbotMessageLogic } from "../services/chatbotService";

export function processChatbotMessage(req: Request, res: Response) {
  const incomingMessage = req.body.Body;
  const cliente = req.body.From;

  // console.log(`Mensaje recibido de ${cliente}: ${incomingMessage}`);

  processChatbotMessageLogic(cliente, incomingMessage);

  res.status(200).send("Message processed");
}
