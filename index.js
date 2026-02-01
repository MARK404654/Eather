require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const express = require("express");

// ----------------------
// Express server for 24/7 uptime
// ----------------------
const app = express();
const PORT = 3000;

app.get("/", (req, res) => {
  res.send("✅ Bot is online!");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// ----------------------
// Discord Bot Setup
// ----------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Cooldown setup
const cooldowns = new Map();
const COOLDOWN_MS = 3000; // 3 seconds per user

// Bot ready event
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Message handler
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith("/eather")) return;

  // Cooldown check
  const now = Date.now();
  const lastUsed = cooldowns.get(message.author.id) || 0;
  if (now - lastUsed < COOLDOWN_MS) {
    return message.reply(`⏳ Slow down! Try again in a few seconds.`);
  }
  cooldowns.set(message.author.id, now);

  const prompt = message.content.slice(7).trim();
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
          {
            role: "user",
            content: prompt
          }
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
    if (replyText.length > 2000) {
      replyText = replyText.slice(0, 2000) + "\n…[truncated]";
    }

    await message.reply(replyText);

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

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
