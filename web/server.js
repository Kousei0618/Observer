const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// ★ Web専用DBインスタンス（Botが起動して global.db にセットしているものを使用）
const db = global.db;
if (!db) {
  console.error("❌ DBが見つかりません。Botが先に起動していません。");
}

// 静的ファイル配信
app.use(express.static(path.join(__dirname, "public")));

console.log("🌐 Webダッシュボード有効化");

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
        activeConversations: stats.activeConversations,
        lastUpdated: guild.last_updated
      };
    }).sort((a, b) => b.score - a.score);

    res.json({ success: true, data: ranking });
  } catch (err) {
    console.error("Ranking API Error:", err);
    res.status(500).json({ success: false, error: "ランキング取得に失敗しました" });
  }
});

// 統計情報
app.get("/api/stats", (req, res) => {
  try {
    const guilds = db.getAllGuilds();
    const convos = db.getAllConversationsData();

    let totalScore = 0;
    let totalConversations = 0;

    for (const guild of guilds) {
      totalScore += guild.total_score || 0;
      totalConversations += guild.conversations_count || 0;
    }

    res.json({
      success: true,
      data: {
        totalGuilds: guilds.length,
        totalScore: totalScore,
        totalConversations: totalConversations,
        activeConversations: convos.length,
        timestamp: Date.now()
      }
    });
  } catch (err) {
    console.error("Stats API Error:", err);
    res.status(500).json({ success: false, error: "統計情報取得に失敗しました" });
  }
});

// ヘルスチェック
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "online",
    timestamp: Date.now()
  });
});

// メインページ
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// サーバー一覧ページ
app.get("/servers", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "servers.html"));
});

// 使い方ページ
app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "about.html"));
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🌐 Web起動 http://localhost:${PORT}`);
});

// 終了処理
process.on("SIGINT", () => {
  console.log("\n🛑 Webサーバー終了中...");
  if (db && typeof db.close === "function") db.close();
  process.exit(0);
});
