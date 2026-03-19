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
const port = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Mastering Backend DM Bot is running!"));
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
                      console.log(`Fetching user list for Day ${day + 1}...`);
                          
                              // Fetch all users in the workspace
                                  const response = await client.users.list();
                                      
                                          // Filter out deleted accounts, other bots, and the default Slackbot
                                              const users = response.members.filter(
                                                    (user) => !user.deleted && !user.is_bot && user.id !== "USLACKBOT"
                                                        );

                                                            console.log(`Found ${users.length} active users. Starting DM broadcast...`);

                                                                // Loop through each user and send a Direct Message
                                                                    for (const user of users) {
                                                                          try {
                                                                                  await client.chat.postMessage({
                                                                                            channel: user.id, // Passing a user ID here automatically opens a DM
                                                                                                      text: messages[day]
                                                                                                              });
                                                                                                                      console.log(`Sent message to ${user.profile.real_name || user.name}`);
                                                                                                                            } catch (err) {
                                                                                                                                    console.error(`Failed to send to ${user.name}:`, err.message);
                                                                                                                                          }
                                                                                                                                                
                                                                                                                                                      // WAIT 1.5 seconds before sending the next message to prevent getting blocked by Slack
                                                                                                                                                            await sleep(1500); 
                                                                                                                                                                }

                                                                                                                                                                    console.log(`Successfully finished broadcasting Day ${day + 1}`);
                                                                                                                                                                        
                                                                                                                                                                            // Update the state so it moves to the next day
                                                                                                                                                                                day++;
                                                                                                                                                                                    fs.writeFileSync(stateFile, JSON.stringify({ currentDay: day }));

                                                                                                                                                                                      } catch (error) {
                                                                                                                                                                                          console.error("Fatal error during broadcast:", error);
                                                                                                                                                                                            }
                                                                                                                                                                                            }

                                                                                                                                                                                            // Schedule the task for 9:00 AM WAT
                                                                                                                                                                                            cron.schedule("0 9 * * *", () => {
                                                                                                                                                                                              console.log("Cron job triggered. Starting mass DM...");
                                                                                                                                                                                                sendDailyMessageToAll();
                                                                                                                                                                                                }, {
                                                                                                                                                                                                  timezone: "Africa/Lagos"
                                                                                                                                                                                                  });

                                                                                                                                                                                                  console.log("Bot is awake and ready to send DMs! Waiting for 9:00 AM...");