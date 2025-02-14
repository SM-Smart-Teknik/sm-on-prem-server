const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");
const { getAccessToken } = require("./auth");

const NEXT_EVENT_PREFIX = "AO:";

async function addEventToOutlook(workOrder, userEmail) {
  const accessToken = await getAccessToken();
  const client = Client.init({
    authProvider: (done) => done(null, accessToken),
  });

  const subject = `${NEXT_EVENT_PREFIX}${workOrder.name} `;

  // Check if event exists for this specific user
  if (await workOrderExists(client, subject, userEmail)) {
    console.log(`Event already exists for ${userEmail}: ${subject}`);
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
    // Post to specific user's calendar
    await client.api(`/users/${userEmail}/calendar/events`).post(event);
    console.log(`Added event to ${userEmail}'s calendar: ${subject}`);
  } catch (error) {
    console.error(`Error adding event for ${userEmail}:`, error);
    throw error;
  }
}

async function workOrderExists(client, subject, userEmail) {
  try {
    const events = await client
      .api(`/users/${userEmail}/calendar/events`)
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

async function deleteEventFromOutlook(userEmail) {
  const accessToken = await getAccessToken();
  const client = Client.init({
    authProvider: (done) => done(null, accessToken),
  });

  try {
    // Only fetch events that start with "AO "
    const events = await client
      .api(`/users/${userEmail}/calendar/events`)
      .filter(`startsWith(subject, '${NEXT_EVENT_PREFIX}')`)
      .get();

    console.log(
      `${EMOJI.INFO} Found ${events.value.length} events with prefix "${NEXT_EVENT_PREFIX}"`
    );
    return events.value;
  } catch (error) {
    console.error(`${EMOJI.ERROR} Error fetching events:`, error);
    throw error;
  }
}

module.exports = {
  addEventToOutlook,
  deleteEventFromOutlook,
  NEXT_EVENT_PREFIX,
};
