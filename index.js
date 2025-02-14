const { fetchWorkOrders } = require("./fetchWorkOrders");

async function main() {
  const workOrders = await fetchWorkOrders();

  if (!workOrders) {
    console.error("No work orders fetched.");
    return;
  }

  console.log(workOrders);
}

main();
