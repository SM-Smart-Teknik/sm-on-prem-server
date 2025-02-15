const axios = require("axios");
const EMOJI = require("../emojis");
const { addLog } = require("../utils");

async function getWorkOrderDetails(workOrderId) {
  try {
    const response = await axios.get(
      `https://api.next-tech.com/v1/workorder/${workOrderId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_TOKEN}`,
          Accept: "application/json",
        },
      },
    );

    return response.data;
  } catch (error) {
    addLog(
      `${EMOJI.ERROR} Failed to fetch work order details: ${error.message}`,
    );
    throw error;
  }
}

module.exports = { getWorkOrderDetails };
