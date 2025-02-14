async function fetchWorkOrders() {
  const userId = 32;

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];

  // Set the start date as today and end date as 14 days later
  const startDate = `${today}T00:00:00`;
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 14); // Add 14 days
  const endDateFormatted = endDate.toISOString().split("T")[0] + "T00:00:00";

  const filter = encodeURIComponent(
    `[["ProductionEnd",">=","${startDate}"],["ProductionStart","<=","${endDateFormatted}"]]`
  );
  const url = `https://next.nordsys.se/200202/cgi/me.cgi/data/store/UserWorkOrderScheduleStore?user=${userId}&type=json&filter=${filter}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        cookie: "milltimesessionid=CBAIzyA8w33TSRzLKH0890G+", // Replace with actual session cookie if needed
      },
      credentials: "include", // Ensures cookies (if required) are sent
    });

    console.log("Response Status:", response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error Response Body:", errorText);
      throw new Error(`Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Fetched Work Orders:", data);
    return data;
  } catch (error) {
    console.error("Failed to fetch work orders:", error);
    return null;
  }
}

// Call the function to test it
fetchWorkOrders();

module.exports = { fetchWorkOrders };
