const express = require("express");
const path = require("path");
const BotDatabase = require("../database");

const app = express();
const PORT = process.env.PORT || 3000;


// データベース接続
const db = new BotDatabase();

// 静的ファイル配信
app.use(express.static(path.join(__dirname, "public")));

// ===== API エンドポイント =====

// ランキング取得API
app.get("/api/ranking", (req, res) => {
  try {
    const guilds = db.getAllGuilds();
    
    // ランキング作成（進行中会話も含む）
    const ranking = guilds.map(guild => {
      const stats = db.getGuildStats(guild.guild_id);
      return {
        guildId: guild.guild_id,
        guildName: guild.guild_name || "Unknown Server",
        totalScore: stats.totalScore,
        liveScore: stats.liveScore,
        score: stats.totalWithLive,
        conversationsCount: stats.conversationsCount,
        activeConversations: stats.activeConversations,
        lastUpdated: guild.last_updated
      };
    }).sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      data: ranking,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Ranking API Error:", error);
    res.status(500).json({
      success: false,
      error: "ランキング取得に失敗しました"
    });
  }
});

// 統計情報取得API
app.get("/api/stats", (req, res) => {
  try {
    const guilds = db.getAllGuilds();
    const allConversations = db.getAllConversationsData();
    
    let totalScore = 0;
    let totalConversations = 0;
    
    for (const guild of guilds) {
      totalScore += guild.total_score;
      totalConversations += guild.conversations_count;
    }

    res.json({
      success: true,
      data: {
        totalGuilds: guilds.length,
        totalScore: totalScore,
        totalConversations: totalConversations,
        activeConversations: allConversations.length,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error("Stats API Error:", error);
    res.status(500).json({
      success: false,
      error: "統計情報取得に失敗しました"
    });
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

// サーバー一覧
app.get("/servers", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "servers.html"));
});

// 使い方ページ
app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "about.html"));
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🌐 Webダッシュボード起動: http://localhost:${PORT}`);
});

// 終了処理
process.on("SIGINT", () => {
  console.log("\n🛑 Webサーバー終了中...");
  db.close();
  process.exit(0);
});

