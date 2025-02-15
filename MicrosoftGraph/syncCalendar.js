// Add new import for checkAndUpdateEvent
const { addEventToOutlook, checkAndUpdateEvent } = require("./outlookCalendar");
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

  // Handle work order syncing
  for (const workOrder of workOrders) {
    try {
      const workOrderDetails = await getWorkOrderDetails(workOrder.WorkOrderId);
      const userEmail = USEREMAILMAP[workOrder.UserName];

      if (!userEmail) {
        addLog(
          `${EMOJI.WARN} Skipping sync - No email mapping for user: ${workOrder.UserName}`,
        );
        continue;
      }

      // Create calendar event object
      const calendarEvent = {
        name: `${workOrder.Name} ${workOrder.Id}`,
        description: `
        ${EMOJI.PROJECT} Projekt: ${workOrderDetails.projectnumber} - ${workOrderDetails.projectname}${
          workOrderDetails.description
            ? `\n\n        ${EMOJI.DESCRIPTION} Beskrivning:\n        ${workOrderDetails.description}`
            : ""
        }

        ${EMOJI.CUSTOMER} Kund: ${workOrderDetails.customername}
        ${EMOJI.STATUS} Status: ${workOrderDetails.statusname}
        ${EMOJI.TIME} Tid: ${new Date(workOrder.ProductionStart).toLocaleDateString("sv-SE")} - ${new Date(workOrder.ProductionEnd).toLocaleDateString("sv-SE")}`.trim(),
        productionstart: workOrder.ProductionStart,
        productionend: workOrder.ProductionEnd,
        customername: workOrder.UserName,
      };

      // Try to update existing event or create new one
      const wasUpdated = await checkAndUpdateEvent(calendarEvent, userEmail);

      if (wasUpdated) {
        addLog(
          `${EMOJI.UPDATE} Updated existing event for work order ${workOrder.Id} (${workOrder.UserName})`,
        );
      } else {
        // If no event exists or no update was needed, create new event
        await addEventToOutlook(calendarEvent, userEmail);
        addLog(
          `${EMOJI.SUCCESS} Created new event for work order ${workOrder.Id} (${workOrder.UserName})`,
        );
      }
    } catch (error) {
      addLog(
        `${EMOJI.ERROR} Failed to sync work order ${workOrder.Id}: ${error.message}`,
      );
    }
  }

  addLog(`${EMOJI.SUCCESS} Calendar sync completed`);
}

module.exports = { syncWorkOrdersToCalendar };
