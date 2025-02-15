const { addEventToOutlook } = require("./outlookCalendar");
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

      // Create new calendar event
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

  addLog(`${EMOJI.SUCCESS} Calendar sync completed`);
}

module.exports = { syncWorkOrdersToCalendar };
