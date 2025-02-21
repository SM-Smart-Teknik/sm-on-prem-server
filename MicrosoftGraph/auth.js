const axios = require("axios");
require("dotenv").config();
const { addLog } = require("../utils");
const EMOJI = require("../emojis");

async function getAccessToken() {
  try {
    const response = await axios.post(
      `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        scope: "https://graph.microsoft.com/.default",
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
    );

    return response.data.access_token;
  } catch (error) {
    addLog(
      `${EMOJI.ERROR} Error getting access token: ${error.response ? error.response.data : error.message}`,
    );
    throw error;
  }
}

module.exports = { getAccessToken };
