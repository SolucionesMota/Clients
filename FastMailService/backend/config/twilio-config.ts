import twilio from "twilio";

const accountSid = "AC7318f1c6dba626ae767704a9ad58673a";
const authToken = "c5e51a474171ce5bba0cb4c40163c3c3";
const sandboxNumber = "whatsapp:+14155238886";
const client = twilio(accountSid, authToken);

export { client, sandboxNumber };
