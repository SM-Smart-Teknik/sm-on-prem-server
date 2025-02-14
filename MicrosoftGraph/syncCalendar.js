const {
  addEventToOutlook,
  deleteEventFromOutlook,
  NEXT_EVENT_PREFIX,
} = require("./outlookCalendar");
const USEREMAILMAP = require("./config");
const EMOJI = require("../emojis");
const { getWorkOrderDetails } = require("../NextProject/nextApi");

// Keep track of previous work orders
let previousWorkOrders = new Map();

async function syncWorkOrdersToCalendar(workOrders) {
  console.log(
    `${EMOJI.FETCH} Starting calendar sync for ${workOrders.length} work orders...`,
  );

  // Create map of current work orders
  const currentWorkOrders = new Map(workOrders.map((wo) => [wo.Id, wo]));

  // Find deleted work orders
  for (const [email, username] of Object.entries(USEREMAILMAP)) {
    try {
      console.log(
        `${EMOJI.INFO} Checking for deleted events for ${username}...`,
      );

      // Get all Next Project events from Outlook
      const outlookEvents = await deleteEventFromOutlook(email);

      for (const event of outlookEvents) {
        // Extract work order ID from event subject
        const workOrderId = event.subject
          .replace(NEXT_EVENT_PREFIX, "")
          .split(":")[1]
          .trim();

        // If work order no longer exists in current set, delete the event
        if (!currentWorkOrders.has(workOrderId)) {
          console.log(
            `${EMOJI.WARN} Deleting removed work order event: ${event.subject}`,
          );
          await client
            .api(`/users/${email}/calendar/events/${event.id}`)
            .delete();
        }
      }
    } catch (error) {
      console.error(
        `${EMOJI.ERROR} Error handling deletions for ${username}:`,
        error,
      );
    }
  }

  // Handle additions/updates
  for (const workOrder of workOrders) {
    try {
      // Fetch detailed work order information
      const workOrderDetails = await getWorkOrderDetails(workOrder.WorkOrderId);

      const description = `
      ${EMOJI.PROJECT} Projekt: ${workOrderDetails.projectnumber} - ${workOrderDetails.projectname}${
        workOrderDetails.description
          ? `

        ${EMOJI.DESCRIPTION} Beskrivning:
        ${workOrderDetails.description}`
          : ""
      }
        
        ${EMOJI.CUSTOMER} Kund: ${workOrderDetails.customername}
        ${EMOJI.STATUS} Status: ${workOrderDetails.statusname}
        ${EMOJI.TIME} Tid: ${new Date(workOrder.ProductionStart).toLocaleDateString("sv-SE")} - ${new Date(workOrder.ProductionEnd).toLocaleDateString("sv-SE")}`.trim();

      const calendarEvent = {
        name: workOrder.Name,
        description: description,
        productionstart: workOrder.ProductionStart,
        productionend: workOrder.ProductionEnd,
        customername: workOrder.UserName,
      };

      const userEmail = USEREMAILMAP[workOrder.UserName];
      if (!userEmail) {
        console.log(
          `${EMOJI.WARN} Skipping sync - No email mapping for user: ${workOrder.UserName}`,
        );
        continue;
      }

      console.log(
        `${EMOJI.CACHE} Syncing work order ${workOrder.Id} for ${workOrder.UserName}`,
      );
      await addEventToOutlook(calendarEvent, userEmail);
    } catch (error) {
      console.error(
        `${EMOJI.ERROR} Failed to sync work order ${workOrder.Id}:`,
        error,
      );
    }
  }

  // Update previous work orders map
  previousWorkOrders = currentWorkOrders;

  console.log(`${EMOJI.SUCCESS} Calendar sync completed`);
}

module.exports = { syncWorkOrdersToCalendar };
