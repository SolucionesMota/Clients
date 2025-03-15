import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const sigylmexApiToken = process.env.SIGYL_TOKEN;
const sigylmexApiUrl = "https://api-envios.appsincode.com/api";

if (!sigylmexApiToken) {
  throw new Error("Sigylmex API token is not defined");
}

async function fetchSigilmexData(
  object: string,
  id?: string,
  body?: any
): Promise<any> {
  try {
    console.log("fetchSigilmexData called with object:", object, "body:", body);

    // **TEMPORARY TEST API CALL with 30-second timeout**
    const testApiUrl = "https://jsonplaceholder.typicode.com/todos/1";
    console.log("Attempting to fetch from test API:", testApiUrl);
    const testApiResponse = await axios.get(testApiUrl, {
      // **CONFIG OBJECT ADDED HERE**
      timeout: 30000, // 30 seconds timeout in milliseconds
    });

    console.log("Test API Response Status:", testApiResponse.status);
    console.log("Test API Response Data:", testApiResponse.data);

    if (testApiResponse.status === 200) {
      console.log("Test API call successful, now trying Sigylmex API...");
      // **SIGYLMEX API CALL with 30-second timeout**
      const requested_object = await axios.post(
        `${sigylmexApiUrl}/v2/${object}`,
        body,
        {
          headers: {
            Authorization: `${sigylmexApiToken}`,
          },
          timeout: 30000, // 30 seconds timeout in milliseconds  **CONFIG OBJECT ADDED HERE**
        }
      );
      console.log("Sigylmex API Response Status:", requested_object.status);
      return requested_object.data;
    } else {
      console.log("Test API call failed, Sigylmex API call skipped.");
      throw new Error(
        `Test API call failed with status: ${testApiResponse.status}`
      );
    }
  } catch (error: any) {
    if (error.code === "ECONNABORTED" && error.message.includes("timeout")) {
      console.error("Request timed out after 30 seconds:", error.message);
      throw new Error(
        "Request timed out. The API may be taking too long to respond."
      );
    } else {
      console.error("Error in fetchSigilmexData:", error);
      throw new Error(`Failed to fetch data: ${error.message}`);
    }
  }
}

export { fetchSigilmexData };
