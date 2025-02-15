const {
  addEventToOutlook,
  deleteEventFromOutlook,
  NEXT_EVENT_PREFIX,
} = require("./outlookCalendar");
const USEREMAILMAP = require("./config");
const EMOJI = require("../emojis");
const { getWorkOrderDetails } = require("../NextProject/nextApi");
const { addLog } = require("../utils");

// Keep track of previous work orders
let previousWorkOrders = new Map();

// Modify the syncWorkOrdersToCalendar function
async function syncWorkOrdersToCalendar(workOrders) {
  addLog(
    `${EMOJI.FETCH} Starting calendar sync for ${workOrders.length} work orders...`,
  );

  // Create set of current work order IDs
  const currentWorkOrderIds = new Set(workOrders.map((wo) => wo.Id));

  // If we have previous work orders, check for deletions
  if (previousWorkOrders.size > 0) {
    addLog(`${EMOJI.INFO} Checking for deleted work orders...`);

    for (const [prevId, prevWorkOrder] of previousWorkOrders) {
      if (!currentWorkOrderIds.has(prevId)) {
        const userEmail = USEREMAILMAP[prevWorkOrder.UserName];
        if (userEmail) {
          console.log(
            `${EMOJI.WARN} Work order ${prevId} no longer exists - deleting from calendar`,
          );
          try {
            const deleted = await deleteEventFromOutlook(prevId, userEmail);
            if (deleted) {
              console.log(
                `${EMOJI.SUCCESS} Successfully deleted events for work order ${prevId}`,
              );
            }
          } catch (error) {
            console.error(
              `${EMOJI.ERROR} Failed to delete work order ${prevId}:`,
              error,
            );
          }
        }
      }
    }
  }

  // Handle additions and updates
  for (const workOrder of workOrders) {
    try {
      const workOrderDetails = await getWorkOrderDetails(workOrder.WorkOrderId);

      // Create calendar event object
      const calendarEvent = {
        name: `${workOrder.Id} ${workOrder.Name}`, // Include ID in name for better tracking
        description: `
${EMOJI.PROJECT} Projekt: ${workOrderDetails.projectnumber} - ${workOrderDetails.projectname}${
          workOrderDetails.description
            ? `

${EMOJI.DESCRIPTION} Beskrivning:
${workOrderDetails.description}`
            : ""
        }

${EMOJI.CUSTOMER} Kund: ${workOrderDetails.customername}
${EMOJI.STATUS} Status: ${workOrderDetails.statusname}
${EMOJI.TIME} Tid: ${new Date(workOrder.ProductionStart).toLocaleDateString("sv-SE")} - ${new Date(workOrder.ProductionEnd).toLocaleDateString("sv-SE")}`.trim(),
        productionstart: workOrder.ProductionStart,
        productionend: workOrder.ProductionEnd,
        customername: workOrder.UserName,
      };

      const userEmail = USEREMAILMAP[workOrder.UserName];
      if (!userEmail) {
        addLog(
          `${EMOJI.WARN} Skipping sync - No email mapping for user: ${workOrder.UserName}`,
        );
        continue;
      }

      // Delete existing event (if any) and create new one to handle updates
      await deleteEventFromOutlook(workOrder.Id, userEmail);
      await addEventToOutlook(calendarEvent, userEmail);

      addLog(
        `${EMOJI.SUCCESS} Synced work order ${workOrder.Id} for ${workOrder.UserName}`,
      );
    } catch (error) {
      addLog(
        `${EMOJI.ERROR} Failed to sync work order ${workOrder.Id}: ${error.message}`,
      );
    }
  }

  // Update previous work orders map
  previousWorkOrders = new Map(workOrders.map((wo) => [wo.Id, wo]));

  addLog(`${EMOJI.SUCCESS} Calendar sync completed`);
}

module.exports = { syncWorkOrdersToCalendar };
