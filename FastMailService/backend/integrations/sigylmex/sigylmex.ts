// config/couchdb.js
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const sigylmexApiToken = process.env.SIGYL_TOKEN;
const sigylmexApiUrl = "https://api-envios.appsincode.com/api";
// export const stripeCheckoutSessionId = process.env.STRIPE_CHECKOUT_SESSION_ID;

if (!sigylmexApiToken) {
  throw new Error("Sigylmex API token is not defined");
}
async function fetchSigilmexData(
  object: string,
  id?: string,
  body?: any
): Promise<any> {
  const fetch = require("node-fetch");

  try {
    const response = await fetch(`${sigylmexApiUrl}/v2/cotizar`, {
      // URL base + endpoint "cotizar"
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: sigylmexApiToken,
      },
      body: JSON.stringify(body), // Ahora usamos el body que se pasa a la función
      timeout: 30000,
    });

    if (!response.ok) {
      // Manejar errores HTTP (ej. 404, 500)
      const message = `HTTP error! status: ${response.status}`;
      console.error(message); // Log para debugging
      throw new Error(message); // Lanza el error para que cotizarSigylmex lo capture
    }

    const data = await response.json();
    return data; // **Retornamos los datos aquí**
  } catch (error) {
    console.error("Error fetching Sigylmex data:", error);
    throw error; // Re-lanza el error para que cotizarSigylmex lo maneje
  }
}
export { fetchSigilmexData };
