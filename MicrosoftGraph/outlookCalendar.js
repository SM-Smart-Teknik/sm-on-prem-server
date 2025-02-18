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
    start: {
      dateTime: new Date(workOrder.productionstart).toISOString(),
      timeZone: "Europe/Stockholm", // Use local timezone instead of UTC
    },
    end: {
      dateTime: new Date(workOrder.productionend).toISOString(),
      timeZone: "Europe/Stockholm", // Use local timezone instead of UTC
    },
    body: {
      contentType: "text",
      content: workOrder.description,
    },
    location: { displayName: workOrder.customername },
    showAs: "free", // Add this line
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
          start: {
            dateTime: new Date(workOrder.productionstart).toISOString(),
            timeZone: "Europe/Stockholm",
          },
          end: {
            dateTime: new Date(workOrder.productionend).toISOString(),
            timeZone: "Europe/Stockholm",
          },
          body: {
            contentType: "text",
            content: workOrder.description,
          },
          location: { displayName: workOrder.customername },
          showAs: "free",
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

// Add this new function to outlookCalendar.js
async function removeDeletedWorkOrders(workOrders, userEmail) {
  const accessToken = await getAccessToken();
  const client = Client.init({
    authProvider: (done) => done(null, accessToken),
  });

  try {
    // Get all future events with our prefix
    const now = new Date().toISOString();
    const events = await client
      .api(`/users/${userEmail}/calendar/events`)
      .filter(
        `startsWith(subject, '${NEXT_EVENT_PREFIX}:') and start/dateTime gt '${now}'`,
      )
      .get();

    for (const event of events.value) {
      // Extract work order ID from event subject
      const match = event.subject.match(
        new RegExp(`${NEXT_EVENT_PREFIX}: .* (\\d+)$`),
      );
      if (!match) continue;

      const eventWorkOrderId = match[1];

      // Check if this work order still exists in the current set
      const workOrderExists = workOrders.some(
        (wo) => wo.Id.toString() === eventWorkOrderId,
      );

      if (!workOrderExists) {
        await client
          .api(`/users/${userEmail}/calendar/events/${event.id}`)
          .delete();

        addLog(
          `${EMOJI.DELETE} Removed obsolete future calendar event for work order ${eventWorkOrderId}`,
        );
      }
    }
  } catch (error) {
    addLog(`${EMOJI.ERROR} Error removing obsolete events: ${error.message}`);
    throw error;
  }
}

// Add to exports
module.exports = {
  addEventToOutlook,
  checkAndUpdateEvent,
  removeDeletedWorkOrders,
  NEXT_EVENT_PREFIX,
};
