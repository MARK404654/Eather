require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const express = require("express");

// --------------------- Web Server ---------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ Bot is online!");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// --------------------- Discord Client ---------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const cooldowns = new Map();
const COOLDOWN_MS = 3000;

// --------------------- Ready Event ---------------------
client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({
    status: "online",
    activities: [{ name: "Type !eather to chat", type: 0 }]
  });
});

// --------------------- Error Logging ---------------------
client.on("error", console.error);
client.on("shardError", console.error);
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// --------------------- Message Handler ---------------------
client.on("messageCreate", async (message) => {
  console.log(`[DEBUG] Message received from ${message.author.tag}: "${message.content}"`);

  if (message.author.bot) return;

  const prefix = "!eather";
  if (!message.content.toLowerCase().startsWith(prefix)) return;

  const now = Date.now();
  const lastUsed = cooldowns.get(message.author.id) || 0;
  if (now - lastUsed < COOLDOWN_MS) {
    return message.reply("⏳ Slow down! Try again in a few seconds.");
  }
  cooldowns.set(message.author.id, now);

  const prompt = message.content.slice(prefix.length).trim();
  if (!prompt) return message.reply("❌ Please provide a prompt.");

  try {
    await message.channel.sendTyping();

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content:
              "You are a genius programmer AI named Eather. You know ALL programming languages and explain clearly with examples. Keep responses short enough to fit in Discord messages under 2000 characters. Always format code in triple backticks with language."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 800
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    let replyText = response.data.choices?.[0]?.message?.content || "❌ No response.";
    if (replyText.length > 2000) replyText = replyText.slice(0, 2000) + "\n…[truncated]";

    try {
      await message.reply(replyText);
    } catch (err) {
      console.error("[ERROR] Failed to reply:", err.message);
      await message.channel.send("❌ I couldn’t send a reply. Check my permissions.");
    }

  } catch (error) {
    const status = error.response?.status;
    if (status === 429) {
      message.reply("🚦 Rate limit hit. Please wait a few seconds.");
    } else {
      console.error("Groq API Error:", error.response?.data || error.message);
      message.reply("❌ Groq API error. Try again.");
    }
  }
});

// --------------------- Self Ping (Keep Render Awake) ---------------------
const SELF_URL = process.env.SELF_URL;

if (SELF_URL) {
  setInterval(() => {
    axios.get(SELF_URL)
      .then(() => console.log("🌐 Self-ping successful"))
      .catch(err => console.error("❌ Self-ping failed:", err.message));
  }, 4 * 60 * 1000);
}

// --------------------- Login ---------------------
if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN is not set. Check your .env file or Render environment variables.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log("🔑 Bot login successful"))
  .catch(err => console.error("❌ Bot login failed:", err.message));
