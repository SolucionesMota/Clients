// config/couchdb.js
import axios from "axios";
import dotenv from "dotenv";
import { Checkout_Session } from "./stripe-types";

// Load environment variables from .env file
dotenv.config();

const stripeApiUrl = process.env.STRIPE_API_URL;
const stripeApiToken = process.env.STRIPE_API_KEY_TEST;
// export const stripeCheckoutSessionId = process.env.STRIPE_CHECKOUT_SESSION_ID;

if (!stripeApiToken) {
  throw new Error("COUCHDB_URL is not defined");
}

async function fetchStripeData(object: string, id?: string): Promise<any> {
  try {
    if (id) {
      const requested_object: Checkout_Session = await axios.get(
        `${stripeApiUrl}/v1/${object}/${id}`,
        {
          headers: {
            Authorization: `Bearer ${stripeApiToken}`,
          },
        }
      );
      return requested_object;
    } else {
      const all_objects = await axios.get(`${stripeApiUrl}/v1/${object}`, {
        headers: {
          Authorization: `Bearer ${stripeApiToken}`,
        },
      });

      return all_objects.data;
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch data from stripe: ${error.message}`);
  }
}

async function getCheckoutSession(
  sessionId: string
): Promise<Checkout_Session> {
  const checkout_session_object: Checkout_Session = await fetchStripeData(
    "checkout/sessions",
    sessionId
  );
  // console.log("checkout_session_object", checkout_session_object);
  return checkout_session_object;
}

export { fetchStripeData, getCheckoutSession };
