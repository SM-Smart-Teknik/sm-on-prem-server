const EventEmitter = require("events");

const logEmitter = new EventEmitter();
const logs = {
  entries: [],
  maxSize: 100,
};

function formatDateTime(date) {
  const options = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };

  return new Date(date).toLocaleString("sv-SE", options).replace(",", "");
}

function addLog(message) {
  const timestamp = formatDateTime(new Date());
  const formattedMessage = `[${timestamp}] ${message}`;

  logs.entries.unshift(formattedMessage);

  if (logs.entries.length > logs.maxSize) {
    logs.entries = logs.entries.slice(0, logs.maxSize);
  }

  console.log(message);
  logEmitter.emit("newLog", formattedMessage);
}

module.exports = {
  logs,
  addLog,
  logEmitter,
  formatDateTime,
};
