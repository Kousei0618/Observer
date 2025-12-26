const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Botが作ったDBを使う
const BotDatabase = require("../database");
const db = new BotDatabase();


if (!db) {
  console.error("❌ DBが見つかりません。Botが先に起動していません。");
}

// 静的ファイル配信
app.use(express.static(path.join(__dirname, "public")));

// ===== API =====

app.get("/api/ranking", (req, res) => {
  try {
    const guilds = db.getAllGuilds();

    const ranking = guilds.map(guild => {
      const stats = db.getGuildStats(guild.guild_id);
      return {
        guildId: guild.guild_id,
        guildName: guild.guild_name || "Unknown Server",
        score: stats.totalWithLive
      };
    }).sort((a, b) => b.score - a.score);

    res.json({ success: true, data: ranking });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false });
  }
});

app.get("/api/stats", (req, res) => {
  try {
    const guilds = db.getAllGuilds();
    res.json({ success: true, totalGuilds: guilds.length });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`🌐 Web起動 http://localhost:${PORT}`);
});

