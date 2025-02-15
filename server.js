const express = require("express");
const cors = require("cors");
const {
  fetchPlanning,
  getValidSessionCookie,
} = require("./NextProject/fetchPlanning");
const EMOJI = require("./emojis");
const { syncWorkOrdersToCalendar } = require("./MicrosoftGraph/syncCalendar");
const { addLog, logs, logEmitter } = require("./utils"); // Import both addLog and logs
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
          .logs {
            background: #1e1e1e;
            color: #fff;
            padding: 15px;
            border-radius: 4px;
            margin-top: 20px;
            height: 400px;
            overflow-y: auto;
            font-family: monospace;
          }
          .log-entry {
            margin: 5px 0;
            white-space: pre-wrap;
            word-wrap: break-word;
            border-bottom: 1px solid #333;
            padding-bottom: 5px;
          }
          .refresh-button {
            margin: 10px 0;
            padding: 8px 16px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
          .refresh-button:hover {
            background: #0056b3;
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
        
        <h2>Server Logs</h2>
        <button class="refresh-button" onclick="window.location.reload()">Refresh Logs</button>
        <div class="logs" id="logContainer">
          ${
            logs.entries.length > 0
              ? logs.entries
                  .map((log) => `<div class="log-entry">${log}</div>`)
                  .join("")
              : '<div class="log-entry">No logs yet...</div>'
          }
        </div>

        <script>
          const logContainer = document.getElementById('logContainer');
          const evtSource = new EventSource('/events');
          
          evtSource.onmessage = function(event) {
            const log = event.data;
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            logEntry.textContent = log;
            
            logContainer.insertBefore(logEntry, logContainer.firstChild);
            
            // Keep only the latest 100 entries in DOM
            while (logContainer.children.length > 100) {
              logContainer.removeChild(logContainer.lastChild);
            }
          };

          evtSource.onerror = function() {
            console.error('SSE connection failed, retrying...');
          };
        </script>
      </body>
    </html>
  `;

  res.send(html);
});

// Store session ID globally (will be refreshed periodically)
let globalSessionId = null;
let lastFetchTime = null;
let nextFetchTime = null;

// Add this new endpoint before your other routes
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const listener = (log) => {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  };

  logEmitter.on("newLog", listener);

  req.on("close", () => {
    logEmitter.removeListener("newLog", listener);
  });
});

// Route to get planned work orders
app.get("/api/plannedWorkOrders", async (req, res) => {
  try {
    if (!globalSessionId) {
      globalSessionId = await getValidSessionCookie();
    }

    const plannedWorkorders = await fetchPlanning(globalSessionId);

    if (!plannedWorkorders) {
      addLog(`${EMOJI.ERROR} No work orders fetched`);
      return res.status(404).json({ error: "No work orders found" });
    }

    addLog(`${EMOJI.SUCCESS} Work orders fetched successfully`);
    res.json(plannedWorkorders);
  } catch (error) {
    addLog(`${EMOJI.ERROR} Error fetching work orders: ${error.message}`);
    res.status(500).json({ error: "Failed to fetch work orders" });
    globalSessionId = null;
  }
});

// Update the logs endpoint
app.get("/api/logs", (req, res) => {
  res.json(logs.entries);
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
    addLog(`${EMOJI.INFO} Refreshing session...`);
    globalSessionId = await getValidSessionCookie();
    addLog(`${EMOJI.SUCCESS} Session refreshed successfully`);
  } catch (error) {
    addLog(`${EMOJI.ERROR} Failed to refresh session: ${error.message}`);
  }
}, REFRESH_INTERVAL);

// Hourly work order fetch
const HOURLY_FETCH_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

async function fetchWorkOrdersScheduled() {
  try {
    addLog(`${EMOJI.INFO} Running scheduled work order fetch...`);

    if (!globalSessionId) {
      globalSessionId = await getValidSessionCookie();
    }

    const plannedWorkorders = await fetchPlanning(globalSessionId);

    if (!plannedWorkorders) {
      addLog(`${EMOJI.ERROR} Scheduled fetch: No work orders found`);
      return;
    }

    if (plannedWorkorders && plannedWorkorders.rows) {
      // Sync with Outlook calendars
      await syncWorkOrdersToCalendar(plannedWorkorders.rows);
    }

    lastFetchTime = Date.now();
    nextFetchTime = Date.now() + HOURLY_FETCH_INTERVAL;

    addLog(
      `${EMOJI.SUCCESS} Scheduled fetch: Retrieved ${plannedWorkorders.length} work orders`,
    );
    addLog(
      `${EMOJI.INFO} Last fetch: ${new Date(lastFetchTime).toISOString()}`,
    );
    addLog(
      `${EMOJI.INFO} Next fetch: ${new Date(nextFetchTime).toISOString()}`,
    );
  } catch (error) {
    addLog(`${EMOJI.ERROR} Scheduled fetch failed: ${error.message}`);
    globalSessionId = null;
  }
}

setInterval(fetchWorkOrdersScheduled, HOURLY_FETCH_INTERVAL);

// At the end of your file, update the server start section
app.listen(port, () => {
  addLog(`${EMOJI.SERVER} Server started on port ${port}`);
  addLog(`${EMOJI.INFO} Server URL: http://localhost:${port}`);

  // Initial session setup
  getValidSessionCookie()
    .then((sessionId) => {
      globalSessionId = sessionId;
      addLog(`${EMOJI.SUCCESS} Initial session established`);
      fetchWorkOrdersScheduled();
    })
    .catch((error) => {
      addLog(
        `${EMOJI.ERROR} Failed to establish initial session: ${error.message}`,
      );
    });
});
