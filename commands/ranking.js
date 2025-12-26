const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "ranking",
  description: "このサーバーのランキングを表示します",

  async execute(interaction) {
    // ★最速でdeferを実行（DB処理前に）
    await interaction.deferReply();

    const db = global.db;

    // DB存在チェック
    if (!db) {
      return interaction.editReply({
        content: "❌ データベースが初期化されていません。Bot再起動してください。",
      });
    }

    try {
      // 全ギルドデータ取得
      const guilds = db.getAllGuilds();

      if (guilds.length === 0) {
        return interaction.editReply({
          content: "📊 まだランキングデータがありません。\nサーバー内で会話を始めるとランキングに反映されます！",
        });
      }

      // ランキング作成（進行中会話も含める）
      const ranking = guilds.map(guild => {
        const stats = db.getGuildStats(guild.guild_id);
        return {
          guildId: guild.guild_id,
          guildName: guild.guild_name,
          totalScore: stats.totalScore,
          liveScore: stats.liveScore,
          score: stats.totalWithLive,
          conversationsCount: stats.conversationsCount,
          activeConversations: stats.activeConversations
        };
      }).sort((a, b) => b.score - a.score);

      // 自サーバーの順位を検索
      const myGuildId = interaction.guild.id;
      const myIndex = ranking.findIndex(r => r.guildId === myGuildId);

      if (myIndex === -1) {
        return interaction.editReply({
          content: "このサーバーはまだランキングに登録されていません。\n会話を始めるとランキングに参加できます！",
        });
      }

      const myRank = myIndex + 1;
      const myData = ranking[myIndex];

      // 表示データ作成
      const lines = [];

      // 上位1件
      if (ranking[myIndex - 1]) {
        const upper = ranking[myIndex - 1];
        const upperName = upper.guildName || "Unknown Server";
        lines.push(
          `⬆ **${myRank - 1}位** : ${upperName} - ${upper.score.toFixed(2)}${upper.liveScore > 0 ? " 🔥" : ""}`
        );
      }

      // 自サーバー
      lines.push(
        `🏆 **${myRank}位（このサーバー）** : ${myData.score.toFixed(2)}${myData.liveScore > 0 ? " 🔥" : ""}`
      );

      // 下位1件
      if (ranking[myIndex + 1]) {
        const lower = ranking[myIndex + 1];
        const lowerName = lower.guildName || "Unknown Server";
        lines.push(
          `⬇ **${myRank + 1}位** : ${lowerName} - ${lower.score.toFixed(2)}${lower.liveScore > 0 ? " 🔥" : ""}`
        );
      }

      // 統計情報
      const stats = [
        ``,
        `📈 **このサーバーの統計**`,
        `確定スコア: ${myData.totalScore.toFixed(2)}`,
        `進行中スコア: ${myData.liveScore.toFixed(2)} 🔥`,
        `完了した会話数: ${myData.conversationsCount}回`,
        `進行中の会話: ${myData.activeConversations}個`,
        ``,
        `参加サーバー総数: ${ranking.length}サーバー`
      ].join("\n");

      // 順位による色変更
      let color;
      if (myRank === 1) color = 0xFFD700; // 金
      else if (myRank === 2) color = 0xC0C0C0; // 銀
      else if (myRank === 3) color = 0xCD7F32; // 銅
      else color = 0x5865F2; // デフォルト

      // Embed作成
      const embed = new EmbedBuilder()
        .setTitle("📊 サーバー会話密度ランキング")
        .setDescription(lines.join("\n") + stats)
        .setColor(color)
        .setFooter({ 
          text: "🔥は進行中の会話 | 会話終了後30秒でスコア確定" 
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error("Ranking command error:", error);
      await interaction.editReply({
        content: "❌ ランキング取得中にエラーが発生しました。\n```\n" + error.message + "\n```"
      });
    }
  }
};
