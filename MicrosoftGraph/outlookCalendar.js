const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");
const { getAccessToken } = require("./auth");
const EMOJI = require("../emojis");
const NEXT_EVENT_PREFIX = "AO";
const { addLog } = require("../utils");

async function addEventToOutlook(workOrder, userEmail) {
  const accessToken = await getAccessToken();
  const client = Client.init({
    authProvider: (done) => done(null, accessToken),
  });

  const subject = `${NEXT_EVENT_PREFIX}: ${workOrder.name}`;

  // Check if event exists for this specific user
  if (await workOrderExists(client, subject, userEmail)) {
    addLog(`${EMOJI.INFO} Event already exists for ${userEmail}: ${subject}`);
    return;
  }

  const event = {
    subject,
    start: { dateTime: workOrder.productionstart, timeZone: "UTC" },
    end: { dateTime: workOrder.productionend, timeZone: "UTC" },
    body: {
      contentType: "text",
      content: workOrder.description,
    },
    location: { displayName: workOrder.customername },
  };

  try {
    await client.api(`/users/${userEmail}/calendar/events`).post(event);
    addLog(
      `${EMOJI.SUCCESS} Added event to ${userEmail}'s calendar: ${subject}`,
    );
  } catch (error) {
    addLog(
      `${EMOJI.ERROR} Error adding event for ${userEmail}: ${error.message}`,
    );
    throw error;
  }
}

// Update workOrderExists function
async function workOrderExists(client, subject, userEmail) {
  try {
    const events = await client
      .api(`/users/${userEmail}/calendar/events`)
      .filter(`subject eq '${subject}'`)
      .get();
    return events.value.length > 0;
  } catch (error) {
    addLog(
      `${EMOJI.ERROR} Error checking event: ${error.response ? error.response.data : error.message}`,
    );
    return false;
  }
}

// Replace remaining console logs in deleteEventFromOutlook function
async function deleteEventFromOutlook(workOrderId, userEmail) {
  const accessToken = await getAccessToken();
  const client = Client.init({
    authProvider: (done) => done(null, accessToken),
  });

  try {
    const events = await client
      .api(`/users/${userEmail}/calendar/events`)
      .select("id,subject")
      .get();

    const matchingEvents = events.value.filter(
      (event) =>
        event.subject.startsWith(NEXT_EVENT_PREFIX) &&
        event.subject.includes(workOrderId),
    );

    if (matchingEvents.length > 0) {
      addLog(
        `${EMOJI.INFO} Found ${matchingEvents.length} events to delete for work order ${workOrderId}`,
      );

      for (const event of matchingEvents) {
        await client
          .api(`/users/${userEmail}/calendar/events/${event.id}`)
          .delete();
        addLog(`${EMOJI.SUCCESS} Deleted event: ${event.subject}`);
      }
      return true;
    } else {
      addLog(`${EMOJI.INFO} No events found for work order ${workOrderId}`);
      return false;
    }
  } catch (error) {
    addLog(`${EMOJI.ERROR} Error deleting events: ${error.message}`);
    throw error;
  }
}

module.exports = {
  addEventToOutlook,
  deleteEventFromOutlook,
  NEXT_EVENT_PREFIX,
};
