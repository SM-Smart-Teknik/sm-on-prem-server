const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");
const { getAccessToken } = require("./auth");

async function addEventToOutlook(workOrder) {
  const accessToken = await getAccessToken();

  const client = Client.init({
    authProvider: (done) => done(null, accessToken),
  });

  const subject = `Work Order: ${workOrder.name}`;

  if (await workOrderExists(client, subject)) {
    console.log(`Event already exists: ${subject}`);
    return;
  }

  const event = {
    subject,
    start: { dateTime: workOrder.productionstart, timeZone: "UTC" },
    end: { dateTime: workOrder.productionend, timeZone: "UTC" },
    body: {
      content: workOrder.description || "No description provided",
      contentType: "text",
    },
    location: { displayName: workOrder.customername },
  };

  try {
    await client.api("/me/calendar/events").post(event);
    console.log(`Added event: ${subject}`);
  } catch (error) {
    console.error(
      "Error adding event:",
      error.response ? error.response.data : error.message
    );
  }
}

async function workOrderExists(client, subject) {
  try {
    const events = await client
      .api("/me/calendar/events")
      .filter(`subject eq '${subject}'`)
      .get();
    return events.value.length > 0;
  } catch (error) {
    console.error(
      "Error checking event:",
      error.response ? error.response.data : error.message
    );
    return false;
  }
}

module.exports = { addEventToOutlook };
