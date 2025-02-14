const puppeteer = require("puppeteer");
const fetch = require("node-fetch");
const fs = require("fs").promises;
const path = require("path");
const nodemailer = require("nodemailer");

const COOKIE_FILE = path.join(__dirname, ".cookie-cache.json");
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const EMOJI = require("../emojis");
require("dotenv").config();

// Add email configuration
const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM,
  to: process.env.EMAIL_TO,
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
};

// Add these constants at the top of the file

async function sendErrorEmail(error, context) {
  const transporter = nodemailer.createTransport(EMAIL_CONFIG.smtp);

  const emailContent = {
    from: EMAIL_CONFIG.from,
    to: EMAIL_CONFIG.to,
    subject: `${EMOJI.ERROR} Error in SM On-Prem Server - ${context}`,
    text: `
${EMOJI.SERVER} Error occurred in: ${context}
${EMOJI.INFO} Timestamp: ${new Date().toISOString()}
${EMOJI.ERROR} Error message: ${error.message}
${EMOJI.WARN} Stack trace: ${error.stack}
    `,
  };

  try {
    await transporter.sendMail(emailContent);
    console.log(`${EMOJI.EMAIL} Error notification email sent`);
  } catch (emailError) {
    console.error(`${EMOJI.ERROR} Failed to send error email:`, emailError);
  }
}

async function getCachedCookie() {
  try {
    const cookieData = await fs.readFile(COOKIE_FILE, "utf8");
    const { cookie, timestamp } = JSON.parse(cookieData);

    // Check if cookie is expired (older than 24 hours)
    if (Date.now() - timestamp < COOKIE_MAX_AGE) {
      console.log(`${EMOJI.COOKIE} Using cached cookie`);
      return cookie;
    }
    console.log(`${EMOJI.WARN} Cached cookie expired`);
    return null;
  } catch (error) {
    console.log(`${EMOJI.INFO} No cached cookie found`);
    return null;
  }
}

async function saveCookie(cookie) {
  const cookieData = {
    cookie,
    timestamp: Date.now(),
  };
  await fs.writeFile(COOKIE_FILE, JSON.stringify(cookieData));
  console.log(`${EMOJI.CACHE} Saved cookie to cache`);
}

async function getValidSessionCookie() {
  // Try to get cached cookie first
  const cachedCookie = await getCachedCookie();
  if (cachedCookie) {
    // Verify the cookie is still valid with a test request
    try {
      const isValid = await testCookie(cachedCookie);
      if (isValid) return cachedCookie;
    } catch (error) {
      console.log("🔸 Cached cookie validation failed");
    }
  }

  // If no valid cached cookie, get new one via Puppeteer
  const newCookie = await loginAndGetCookies();
  await saveCookie(newCookie);
  return newCookie;
}

async function testCookie(sessionId) {
  // Make a test request to verify cookie
  try {
    const response = await fetch(
      `https://next.nordsys.se/200202/cgi/me.cgi/data/store/UserWorkOrderScheduleStore?user=32&type=json`,
      {
        headers: {
          Accept: "application/json",
          Cookie: `milltimesessionid=${sessionId}`,
        },
      }
    );
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function loginAndGetCookies() {
  console.log(`${EMOJI.LOGIN} Starting login process...`);
  const browser = await puppeteer.launch({ headless: false, slowMo: 100 }); // Open real Chrome, slow down actions

  const page = await browser.newPage();

  // Go to login page
  await page.goto("https://next.nordsys.se/200202/client/", {
    waitUntil: "networkidle2",
  });

  // Enter username & password
  await page.waitForSelector('[name="userlogin"]', { visible: true });
  await page.click('[name="userlogin"]');
  await page.type('[name="userlogin"]', "lucstr01");

  await page.waitForSelector('[name="password"]', { visible: true });
  await page.click('[name="password"]');
  await page.type('[name="password"]', "Smart2024!");

  await page.waitForSelector("#button-1020", { visible: true });
  await page.click("#button-1020");

  try {
    console.log(`${EMOJI.INFO} Waiting for login...`);

    // Wait for dashboard element
    await page.waitForSelector(".x-panel", {
      visible: true,
      timeout: 60000,
    });

    // Use setTimeout with Promise instead of waitForTimeout
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log(`${EMOJI.SUCCESS} Login successful, getting cookies...`);
    const cookies = await page.cookies();
    await browser.close();

    const sessionCookie = cookies.find(
      (cookie) => cookie.name === "milltimesessionid"
    );

    if (!sessionCookie) {
      throw new Error("Session cookie not found! Check login process.");
    }

    console.log(`${EMOJI.COOKIE} Got session cookie:`, sessionCookie.value);
    return sessionCookie.value;
  } catch (error) {
    console.error(`${EMOJI.ERROR} Login process failed:`, error.message);
    await sendErrorEmail(error, "Login Process");
    await browser.close();
    throw new Error(`Login failed: ${error.message}`);
  }
}

async function fetchPlanning(sessionId) {
  console.log(`${EMOJI.FETCH} Fetching planned work orders...`);
  const userId = 32;
  const today = new Date().toISOString().split("T")[0];
  const startDate = `${today}T00:00:00`;
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 14);
  const endDateFormatted = endDate.toISOString().split("T")[0] + "T00:00:00";

  const filter = encodeURIComponent(
    `[["ProductionEnd",">=","${startDate}"],["ProductionStart","<=","${endDateFormatted}"]]`
  );
  const url = `https://next.nordsys.se/200202/cgi/me.cgi/data/store/UserWorkOrderScheduleStore?user=${userId}&type=json&filter=${filter}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: `milltimesessionid=${sessionId}`, // Use valid session cookie
      },
    });

    console.log("Response Status:", response.status);
    if (!response.ok) {
      throw new Error(`Error: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json();

    console.log(`${EMOJI.SUCCESS} Planned work orders fetched successfully`);
    return data;
  } catch (error) {
    console.error(`${EMOJI.ERROR} Failed to fetch planned work orders:`, error);
    await sendErrorEmail(error, "Fetch Planned Work Orders");
    return null;
  }
}

// Remove the main function and export the necessary functions
module.exports = {
  fetchPlanning,
  getValidSessionCookie,
};
