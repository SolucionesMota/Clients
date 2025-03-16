// // config/couchdb.js
// import axios from "axios";
// import dotenv from "dotenv";
// import querystring from "querystring";

// // Load environment variables from .env file
// dotenv.config();

// const couchdbURL = process.env.COUCHDB_URL;
// const couchdbUser = process.env.ADMIN_USER;
// const couchdbPassword = process.env.ADMIN_PASSWORD;

// if (!couchdbURL) {
//   throw new Error("COUCHDB_URL is not defined");
// }

// let sessionCookie: string | null = null;

// async function authenticate() {
//   if (!couchdbUser || !couchdbPassword) {
//     throw new Error("CouchDB user or password is not defined");
//   }

//   try {
//     const response = await axios.post(
//       `${couchdbURL}/_session`,
//       querystring.stringify({ name: couchdbUser, password: couchdbPassword }), // Datos codificados
//       {
//         headers: {
//           "Content-Type": "application/x-www-form-urlencoded",
//         },
//       }
//     );

//     if (response.status === 200 && response.data.ok) {
//       sessionCookie = response.headers["set-cookie"]?.[0] || "";
//       console.log("Authenticated successfully with CouchDB");
//     } else {
//       throw new Error("Failed to authenticate with CouchDB");
//     }
//   } catch (error) {
//     console.error("Error during CouchDB authentication:", error);
//     throw error;
//   }
// }

// // Authenticate once when the module is loaded
// authenticate().catch((error) => {
//   console.error("Error during CouchDB authentication:", error);
// });

// // Function to get the session cookie for use in requests
// function getSessionCookie() {
//   if (!sessionCookie) {
//     throw new Error("Not authenticated with CouchDB");
//   }
//   return sessionCookie;
// }

// async function fetchDataFromCouchDB(database: string, id?: string) {
//   try {
//     if (id) {
//       const object = await axios.get(`${couchdbURL}/${database}/${id}`, {
//         headers: {
//           Cookie: getSessionCookie(),
//         },
//       });
//       return object.data;
//     } else {
//       const all_docs = await axios.get(`${couchdbURL}/${database}/_all_docs`, {
//         headers: {
//           Cookie: getSessionCookie(),
//         },
//       });
//       const all_docs_ids = all_docs.data.rows.map((row: any) => row.id);
//       let actual_objects = [];
//       for (let id of all_docs_ids) {
//         const object = await axios.get(`${couchdbURL}/${database}/${id}`, {
//           headers: {
//             Cookie: getSessionCookie(),
//           },
//         });
//         actual_objects.push(object.data);
//       }
//       return actual_objects;
//     }
//   } catch (error: any) {
//     return {
//       error: "Failed to fetch data from CouchDB",
//       details: error.message,
//     };
//   }
// }

// async function createDataInCouchDB(database: string, data: any) {
//   try {
//     const response = await axios.post(`${couchdbURL}/${database}`, data, {
//       headers: {
//         Cookie: getSessionCookie(),
//         "Content-Type": "application/json",
//       },
//     });
//     return response.data;
//   } catch (error: any) {
//     return {
//       error: "Failed to create data in CouchDB",
//       details: error.message,
//     };
//   }
// }

// async function deleteDataFromCouchDB(database: string, id: string) {
//   try {
//     const response = await axios.delete(`${couchdbURL}/${database}`, {
//       headers: {
//         Cookie: getSessionCookie(),
//         "If-Match": `${id}`,
//       },
//     });
//     return response.data;
//   } catch (error: any) {
//     return {
//       error: "Failed to delete data from CouchDB",
//       details: error.message,
//     };
//   }
// }

// export {
//   createDataInCouchDB,
//   deleteDataFromCouchDB,
//   fetchDataFromCouchDB,
//   getSessionCookie,
// };
