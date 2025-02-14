const express = require("express");
const cors = require("cors");
const {
  fetchPlanning,
  getValidSessionCookie,
} = require("./NextProject/fetchPlanning");
const EMOJI = require("./emojis");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>SM On-Prem Server</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px;
          }
          .endpoint { 
            background: #f5f5f5; 
            padding: 10px; 
            margin: 10px 0; 
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <h1>🖥️ SM On-Prem Server</h1>
        <p>Version: 1.0.0</p>
        <h2>Available Endpoints:</h2>
        <div class="endpoint">
          <h3>📊 Health Check</h3>
          <p>Path: <code>/health</code></p>
          <p>Method: GET</p>
        </div>
        <div class="endpoint">
          <h3>📋 Work Orders</h3>
          <p>Path: <code>/api/plannedWorkOrders</code></p>
          <p>Method: GET</p>
        </div>
        <p>Status: Running</p>
        <p>Server Time: ${new Date().toISOString()}</p>
        <p>Last Fetch: ${
          lastFetchTime ? new Date(lastFetchTime).toISOString() : "Never"
        }</p>
        <p>Next Fetch: ${
          nextFetchTime
            ? new Date(nextFetchTime).toISOString()
            : "Not scheduled"
        }</p>
      </body>
    </html>
  `;

  res.send(html);
});

// Store session ID globally (will be refreshed periodically)
let globalSessionId = null;
let lastFetchTime = null;
let nextFetchTime = null;

// Route to get planned work orders
app.get("/api/plannedWorkOrders", async (req, res) => {
  try {
    if (!globalSessionId) {
      globalSessionId = await getValidSessionCookie();
    }

    const plannedWorkorders = await fetchPlanning(globalSessionId);

    if (!plannedWorkorders) {
      console.error(`${EMOJI.ERROR} No work orders fetched`);
      return res.status(404).json({ error: "No work orders found" });
    }

    console.log(`${EMOJI.SUCCESS} Work orders fetched successfully`);
    res.json(plannedWorkorders);
  } catch (error) {
    console.error(`${EMOJI.ERROR} Error fetching work orders:`, error);
    res.status(500).json({ error: "Failed to fetch work orders" });

    // Reset session ID on error
    globalSessionId = null;
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    lastFetch: lastFetchTime ? new Date(lastFetchTime).toISOString() : "Never",
    nextFetch: nextFetchTime
      ? new Date(nextFetchTime).toISOString()
      : "Not scheduled",
  });
});

// Session refresh every 23 hours
const REFRESH_INTERVAL = 23 * 60 * 60 * 1000; // 23 hours in milliseconds
setInterval(async () => {
  try {
    console.log(`${EMOJI.INFO} Refreshing session...`);
    globalSessionId = await getValidSessionCookie();
    console.log(`${EMOJI.SUCCESS} Session refreshed successfully`);
  } catch (error) {
    console.error(`${EMOJI.ERROR} Failed to refresh session:`, error);
  }
}, REFRESH_INTERVAL);

// Hourly work order fetch
const HOURLY_FETCH_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

async function fetchWorkOrdersScheduled() {
  try {
    console.log(`${EMOJI.INFO} Running scheduled work order fetch...`);

    if (!globalSessionId) {
      globalSessionId = await getValidSessionCookie();
    }

    const plannedWorkorders = await fetchPlanning(globalSessionId);

    if (!plannedWorkorders) {
      console.error(`${EMOJI.ERROR} Scheduled fetch: No work orders found`);
      return;
    }

    lastFetchTime = Date.now();
    nextFetchTime = Date.now() + HOURLY_FETCH_INTERVAL;

    console.log(
      `${EMOJI.SUCCESS} Scheduled fetch: Retrieved ${plannedWorkorders.length} work orders`
    );
    console.log(
      `${EMOJI.INFO} Last fetch: ${new Date(lastFetchTime).toISOString()}`
    );
    console.log(
      `${EMOJI.INFO} Next fetch: ${new Date(nextFetchTime).toISOString()}`
    );
  } catch (error) {
    console.error(`${EMOJI.ERROR} Scheduled fetch failed:`, error);
    globalSessionId = null;
  }
}

setInterval(fetchWorkOrdersScheduled, HOURLY_FETCH_INTERVAL);

// Start server
app.listen(port, () => {
  console.log(`${EMOJI.SERVER} Server running at http://localhost:${port}`);

  // Initial session setup
  getValidSessionCookie()
    .then((sessionId) => {
      globalSessionId = sessionId;
      console.log(`${EMOJI.SUCCESS} Initial session established`);
      // Run initial fetch after session is established
      fetchWorkOrdersScheduled();
    })
    .catch((error) => {
      console.error(
        `${EMOJI.ERROR} Failed to establish initial session:`,
        error
      );
    });
});
