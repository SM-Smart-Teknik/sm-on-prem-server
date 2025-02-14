require("dotenv").config();
const { Client } = require("@microsoft/microsoft-graph-client");
const { getAccessToken } = require("./auth");
// Function to authenticate and call Microsoft Graph API
async function testGraph() {
  const accessToken = await getAccessToken();
  try {
    // Initialize Graph Client
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken); // Temporary authentication
      },
    });

    // Call the /me endpoint to verify authentication
    const user = await client
      .api("/users/lucas.strand@smartteknik.nu/calendar/events")
      .get();

    console.log("✅ Microsoft Graph User Info:", user);
  } catch (error) {
    console.error("❌ Error calling Microsoft Graph:", error);
  }
}

// Run the test function
testGraph();
