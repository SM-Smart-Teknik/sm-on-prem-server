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

async function checkAndUpdateEvent(workOrder, userEmail) {
  const accessToken = await getAccessToken();
  const client = Client.init({
    authProvider: (done) => done(null, accessToken),
  });

  const subject = `${NEXT_EVENT_PREFIX}: ${workOrder.name}`;

  try {
    // Find existing event
    const events = await client
      .api(`/users/${userEmail}/calendar/events`)
      .filter(`subject eq '${subject}'`)
      .get();

    if (events.value.length > 0) {
      const existingEvent = events.value[0];
      const needsUpdate =
        new Date(existingEvent.start.dateTime).getTime() !==
          new Date(workOrder.productionstart).getTime() ||
        new Date(existingEvent.end.dateTime).getTime() !==
          new Date(workOrder.productionend).getTime() ||
        existingEvent.body.content !== workOrder.description ||
        existingEvent.location.displayName !== workOrder.customername;

      if (needsUpdate) {
        // Update the event
        const updatedEvent = {
          subject,
          start: { dateTime: workOrder.productionstart, timeZone: "UTC" },
          end: { dateTime: workOrder.productionend, timeZone: "UTC" },
          body: {
            contentType: "text",
            content: workOrder.description,
          },
          location: { displayName: workOrder.customername },
        };

        await client
          .api(`/users/${userEmail}/calendar/events/${existingEvent.id}`)
          .update(updatedEvent);

        return true; // Event was updated
      }
    }
    return false; // No event found or no update needed
  } catch (error) {
    addLog(`${EMOJI.ERROR} Error checking/updating event: ${error.message}`);
    throw error;
  }
}

module.exports = {
  addEventToOutlook,
  checkAndUpdateEvent,
  NEXT_EVENT_PREFIX,
};
