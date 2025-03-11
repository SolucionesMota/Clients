// import {
//   createDataInCouchDB,
//   deleteDataFromCouchDB,
//   fetchDataFromCouchDB,
// } from "../db/couchdb";

// export async function getRemitentes(req: Request, res: Response) {
//   try {
//     const data: Cliente[] | undefined = await fetchDataFromCouchDB(
//       "remitentes"
//     );
//     if (!data) {
//       res.status(404).send("No hay remitentes");
//       return;
//     }
//     res.status(200).json(data);
//   } catch (error) {
//     console.error("Error al obtener remitentes:", error);
//     res.status(500).send("Error al obtener remitentes");
//   }
// }

// export async function getRemitenteById(req: Request, res: Response) {
//   const id = req.params.id;
//   const data: Cliente | undefined = await fetchDataFromCouchDB(
//     "remitentes",
//     id
//   );
//   if (!data) {
//     res.status(404).send("No hay remitente con ese id");
//     return;
//   }
//   res.status(200).json(data);
// }

// export async function createRemitente(req: Request, res: Response) {
//   const remitente: Cliente = req.body;
//   const response = await createDataInCouchDB("remitentes", remitente);
//   res.status(200).json(response);
// }

// export async function deleteRemitente(req: Request, res: Response) {
//   const id = req.params.id;
//   const response = await deleteDataFromCouchDB("remitentes", id);
//   res.status(200).json(response);
// }
