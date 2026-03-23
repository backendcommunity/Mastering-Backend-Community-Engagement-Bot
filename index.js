require("dotenv").config();
const { WebClient } = require("@slack/web-api");
const cron = require("node-cron");
const messages = require("./messages");
const fs = require("fs");
const express = require("express");
const { MongoClient } = require("mongodb");
const path = require("path");

const client = new WebClient(process.env.SLACK_TOKEN);
const stateFile = "./state.json";

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect()
.then(client => {
db = client.db("CommunityBot");
console.log(" Successfully connected to MongoDB Cloud!");
})
.catch(err => console.error(" MongoDB connection error:", err));

app.get("/", (req, res) => res.send("Mastering Backend Bot is running and connected to DB!"));

app.get("/admin", (req, res) => {
res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/api/logs", async (req, res) => {
const { secret } = req.query;
if (secret !== process.env.ADMIN_SECRET) {
return res.status(401).send("Unauthorized");
}
if (!db) {
return res.status(500).send("Database not connected");
}

try {
const logs = await db.collection("engagement_logs").find().sort({ timestamp: -1 }).toArray();
res.json(logs);
} catch (err) {
res.status(500).send(err.message);
}
});

app.post("/slack/events", async (req, res) => {
const { type, challenge, event } = req.body;
if (type === "url_verification") {
return res.status(200).send(challenge);
}
if (type === "event_callback" && event.type === "message" && event.channel_type === "im") {
if (event.bot_id) {
return res.status(200).send("Ignored bot message");
}
console.log(` NEW DM FROM USER ID ${event.user}: ${event.text}`);
let userName = event.user;
try {
const userInfo = await client.users.info({ user: event.user });
userName = userInfo.user.profile.real_name || userInfo.user.name;
} catch (nameErr) {
console.error(" Could not fetch user name for ID:", event.user);
}

if (db) {
try {
await db.collection("engagement_logs").insertOne({
userId: event.user,
userName: userName,
channel: event.channel,
message: event.text,
timestamp: new Date()
});
console.log(` Successfully saved DM from ${userName} to database.`);
} catch (err) {
console.error(" Failed to save to database:", err);
}
}
}
res.status(200).send("Event received");
});

app.listen(port, () => console.log(`Web server listening on port ${port}`));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let day = 0;
if (fs.existsSync(stateFile)) {
const data = fs.readFileSync(stateFile);
day = JSON.parse(data).currentDay;
}

async function sendDailyMessageToAll() {
if (day >= messages.length) {
console.log("All 30 days of messages have been sent!");
return;
}
try {
console.log(`Starting broadcast for Day ${day + 1}...`);
try {
await client.chat.postMessage({
channel: process.env.CHANNEL_ID,
text: messages[day]
});
console.log(" Successfully posted to the main channel!");
} catch (err) {
console.error(" Failed to post to main channel:", err.message);
}
console.log("Fetching complete user list for DMs...");
let users = [];
let nextCursor;
do {
const response = await client.users.list({ cursor: nextCursor, limit: 1000 });
const activeHumans = response.members.filter(user => !user.deleted && !user.is_bot && user.id !== "USLACKBOT");
users = users.concat(activeHumans);
nextCursor = response.response_metadata?.next_cursor;
} while (nextCursor);
console.log(` Success! Found a total of ${users.length} active users. Starting DM broadcast...`);
for (const user of users) {
try {
await client.chat.postMessage({
channel: user.id,
text: messages[day]
});
console.log(`Sent DM to ${user.profile.real_name || user.name}`);
} catch (err) {
console.error(`Failed to send DM to ${user.name}:`, err.message);
}
await sleep(1500);
}
console.log(`Successfully finished broadcasting Day ${day + 1}`);
day++;
fs.writeFileSync(stateFile, JSON.stringify({ currentDay: day }));
} catch (error) {
console.error("Fatal error during broadcast:", error);
}
}

cron.schedule("0 9 * * *", () => {
console.log("Cron job triggered. Starting broadcast...");
sendDailyMessageToAll();
}, {
timezone: "Africa/Lagos"
});

console.log("Bot is awake! Waiting for 9:00 AM...");