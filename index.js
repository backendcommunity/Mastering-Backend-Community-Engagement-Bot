require("dotenv").config();
const { WebClient } = require("@slack/web-api");
const cron = require("node-cron");
const messages = require("./messages");
const fs = require("fs");
const express = require("express");

const client = new WebClient(process.env.SLACK_TOKEN);
const stateFile = "./state.json";

// 1. Keep Render happy with a dummy web server
const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Mastering Backend DM Bot is running!"));
app.post("/slack/events", (req, res) => {
      const { type, challenge, event } = req.body;

        // Step A: Slack's Security Handshake
            if (type === "url_verification") {
                return res.status(200).send(challenge);
                  }

                    // Step B: Handle incoming messages
                      if (type === "event_callback" && event.type === "message") {
                          // Ignore messages sent by the bot itself (prevents infinite loops!)
                              if (event.bot_id) {
                                    return res.status(200).send("Ignored bot message");
                                        }

                                            // Log the user's reply!
                                                console.log("-----------------------------------------");
                                                    console.log(` NEW REPLY DETECTED!`);
                                                        console.log(`User ID: ${event.user}`);
                                                            console.log(`Channel/DM ID: ${event.channel}`);
                                                                console.log(`Message: "${event.text}"`);
                                                                    console.log("--------------------------------------");
                                                                                  res.status(200).send("Event received");
                                    }
                                                                                  });
app.listen(port, () => console.log(`Web server listening on port ${port}`));

// 2. Helper function to pause execution (Crucial for Slack Rate Limiting)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 3. Check which day the bot is currently on
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
                          
                              // 1. POST TO THE GENERAL CHANNEL FIRST
                                  try {
                                        await client.chat.postMessage({
                                                channel: process.env.CHANNEL_ID, // Pulls the channel ID from your .env
                                                        text: messages[day]
                                                              });
                                                                    console.log("✅ Successfully posted to the main channel!");
                                                                        } catch (err) {
                                                                              console.error("❌ Failed to post to main channel:", err.message);
                                                                                  }

                                                                                      // 2. FETCH USERS AND SEND INDIVIDUAL DMs
                                                                                        console.log("Fetching complete user list for DMs...");
                                                                                            let users = [];
                                                                                                let nextCursor;

                                                                                                    // Use a loop to keep fetching users if the community has more than 1000 people
                                                                                                        do {
                                                                                                              const response = await client.users.list({ 
                                                                                                                      cursor: nextCursor, 
                                                                                                                              limit: 1000 
                                                                                                                                    });
                                                                                                                                          
                                                                                                                                                const activeHumans = response.members.filter(
                                                                                                                                                        (user) => !user.deleted && !user.is_bot && user.id !== "USLACKBOT"
                                                                                                                                                              );
                                                                                                                                                                    
                                                                                                                                                                          users = users.concat(activeHumans);
                                                                                                                                                                                nextCursor = response.response_metadata?.next_cursor;
                                                                                                                                                                                      
                                                                                                                                                                                          } while (nextCursor);

                                                                                                                                                                                              console.log(`✅ Success! Found a total of ${users.length} active users. Starting DM broadcast...`);

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
                                                                                                                                                                                                    
                                                                                                                                                                                                          await sleep(1500); // 1.5 second delay to prevent rate limits
                                                                                                                                                                                                              }

                                                                                                                                                                                                                  console.log(`Successfully finished broadcasting Day ${day + 1}`);
                                                                                                                                                                                                                      
                                                                                                                                                                                                                          day++;
                                                                                                                                                                                                                              fs.writeFileSync(stateFile, JSON.stringify({ currentDay: day }));

                                                                                                                                                                                                                                } catch (error) {
                                                                                                                                                                                                                                    console.error("Fatal error during broadcast:", error);
                                                                                                                                                                                                                                      }
                                                                                                                                                                                                                                      }
