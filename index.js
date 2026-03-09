require("dotenv").config();
const { WebClient } = require("@slack/web-api");
const cron = require("node-cron");
const messages = require("./messages");
const fs = require("fs");

const client = new WebClient(process.env.SLACK_TOKEN);
const channelId = process.env.CHANNEL_ID;
const stateFile = "./state.json";

// Check which day the bot is currently on
let day = 0;
if (fs.existsSync(stateFile)) {
  const data = fs.readFileSync(stateFile);
    day = JSON.parse(data).currentDay;
    }

    async function sendDailyMessage() {
      if (day >= messages.length) {
          console.log("All messages have been sent!");
              return;
                }

                  try {
                      // Send the message to Slack
                          await client.chat.postMessage({
                                channel: channelId,
                                      text: messages[day]
                                          });
                                              
                                                  console.log(`Successfully sent message for Day ${day + 1}`);
                                                      
                                                          // Update the state so it moves to the next day
                                                              day++;
                                                                  fs.writeFileSync(stateFile, JSON.stringify({ currentDay: day }));
                                                                      
                                                                        } catch (error) {
                                                                            console.error("Error sending message to Slack:", error);
                                                                              }
                                                                              }

                                                                              // Schedule the task for 9:00 AM every day
                                                                              cron.schedule("0 9 * * *", () => {
                                                                                console.log("Cron job triggered...");
                                                                                  sendDailyMessage();
                                                                                  }, {
                                                                                    timezone: "Africa/Lagos"
                                                                                    });

                                                                                    console.log("Bot is awake and scheduler is running! Waiting for 9:00 AM...");

                                                                                    sendDailyMessage();