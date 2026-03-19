require("dotenv").config();
const { WebClient } = require("@slack/web-api");

const client = new WebClient(process.env.SLACK_TOKEN);

async function checkUsers() {
  try {
      console.log("Fetching users from Mastering Backend...");
          const response = await client.users.list();
              
                  // The exact same filter your live bot uses
                      const users = response.members.filter(
                            (user) => !user.deleted && !user.is_bot && user.id !== "USLACKBOT"
                                );

                                    console.log(`✅ Success! Found ${users.length} active human users.`);
                                        
                                            // Print the first 5 names just to prove it works
                                                console.log("Here are the first 5 people it will message tomorrow:");
                                                    users.slice(0, 5).forEach(user => {
                                                          console.log(`- ${user.profile.real_name || user.name} (ID: ${user.id})`);
                                                              });

                                                                } catch (error) {
                                                                    console.error("❌ Error fetching users:", error.message);
                                                                      }
                                                                      }

                                                                      checkUsers();