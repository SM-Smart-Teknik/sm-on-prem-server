const {
  addEventToOutlook,
  checkAndUpdateEvent,
  removeDeletedWorkOrders,
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

  // Group work orders by user
  const userWorkOrders = new Map();
  workOrders.forEach((workOrder) => {
    const userEmail = USEREMAILMAP[workOrder.UserName];
    if (userEmail) {
      if (!userWorkOrders.has(userEmail)) {
        userWorkOrders.set(userEmail, []);
      }
      userWorkOrders.get(userEmail).push(workOrder);
    }
  });

  // Process each user's work orders
  for (const [userEmail, userWOs] of userWorkOrders) {
    try {
      // First remove obsolete events for this user
      await removeDeletedWorkOrders(userWOs, userEmail);

      // Then process current work orders
      for (const workOrder of userWOs) {
        try {
          const workOrderDetails = await getWorkOrderDetails(
            workOrder.WorkOrderId,
          );

          // Create calendar event object
          const calendarEvent = {
            name: `${workOrder.Name} ${workOrder.Id}`,
            description: `
            ${EMOJI.PROJECT} Projekt: ${workOrderDetails.projectnumber} - ${workOrderDetails.projectname}${
              workOrderDetails.description
                ? `\n\n            ${EMOJI.DESCRIPTION} Beskrivning:\n            ${workOrderDetails.description}`
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
          const wasUpdated = await checkAndUpdateEvent(
            calendarEvent,
            userEmail,
          );

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
    } catch (error) {
      addLog(
        `${EMOJI.ERROR} Failed to process work orders for user ${userEmail}: ${error.message}`,
      );
    }
  }

  addLog(`${EMOJI.SUCCESS} Calendar sync completed`);
}

module.exports = { syncWorkOrdersToCalendar };
