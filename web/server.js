const express = require("express");
const path = require("path");
const BotDatabase = require("../database");

const app = express();
const PORT = process.env.PORT || 10000;

// ★ Web専用DBインスタンス（これが正解）
const db = new BotDatabase();

console.log("🌐 Webダッシュボード有効化");

// 静的ファイル配信
app.use(express.static(path.join(__dirname, "public")));

// ===== API =====

// ランキング
app.get("/api/ranking", (req, res) => {
  try {
    const guilds = db.getAllGuilds();

    const ranking = guilds.map(guild => {
      const stats = db.getGuildStats(guild.guild_id);
      return {
        guildId: guild.guild_id,
        guildName: guild.guild_name || "Unknown Server",
        score: stats.totalWithLive,
        totalScore: stats.totalScore,
        liveScore: stats.liveScore,
        conversationsCount: stats.conversationsCount,
        activeConversations: stats.activeConversations
      };
    }).sort((a, b) => b.score - a.score);

    res.json({ success: true, data: ranking });
  } catch (err) {
    console.error("Ranking API Error:", err);
    res.status(500).json({ success: false });
  }
});

// 統計
app.get("/api/stats", (req, res) => {
  try {
    const guilds = db.getAllGuilds();
    const convos = db.getAllConversationsData();

    res.json({
      success: true,
      data: {
        totalGuilds: guilds.length,
        activeConversations: convos.length
      }
    });
  } catch (err) {
    console.error("Stats API Error:", err);
    res.status(500).json({ success: false });
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Web起動 http://localhost:${PORT}`);
});
