const Database = require("better-sqlite3");
const path = require("path");

getAllGuilds() {
  return Object.values(this.guilds || {});
}

class BotDatabase {
  constructor(dbPath = "./data/bot.db") {
    // データフォルダがなければ作成
    const fs = require("fs");
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL"); // パフォーマンス向上
    this.initTables();
    this.prepareCachedStatements();
  }

  initTables() {
    // ギルドスコアテーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS guilds (
        guild_id TEXT PRIMARY KEY,
        guild_name TEXT,
        total_score REAL DEFAULT 0,
        conversations_count INTEGER DEFAULT 0,
        last_updated INTEGER DEFAULT 0
      )
    `);

    // 進行中会話テーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS active_conversations (
        channel_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        last_time INTEGER NOT NULL,
        last_speaker TEXT NOT NULL,
        participants TEXT NOT NULL,
        score REAL DEFAULT 0,
        burst_count INTEGER DEFAULT 1
      )
    `);

    // 会話履歴テーブル（統計用）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        score REAL NOT NULL,
        participants_count INTEGER NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER NOT NULL,
        duration INTEGER NOT NULL
      )
    `);

    console.log("✅ データベーステーブル初期化完了");
  }

  prepareCachedStatements() {
    // ギルド関連
    this.getGuild = this.db.prepare(
      "SELECT * FROM guilds WHERE guild_id = ?"
    );
    
    this.upsertGuild = this.db.prepare(`
      INSERT INTO guilds (guild_id, guild_name, total_score, conversations_count, last_updated)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        guild_name = excluded.guild_name,
        total_score = excluded.total_score,
        conversations_count = excluded.conversations_count,
        last_updated = excluded.last_updated
    `);

    this.incrementGuildScore = this.db.prepare(`
      UPDATE guilds 
      SET total_score = total_score + ?,
          conversations_count = conversations_count + 1,
          last_updated = ?
      WHERE guild_id = ?
    `);

    // 進行中会話関連
    this.getConversation = this.db.prepare(
      "SELECT * FROM active_conversations WHERE channel_id = ?"
    );

    this.upsertConversation = this.db.prepare(`
      INSERT INTO active_conversations 
      (channel_id, guild_id, last_time, last_speaker, participants, score, burst_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(channel_id) DO UPDATE SET
        guild_id = excluded.guild_id,
        last_time = excluded.last_time,
        last_speaker = excluded.last_speaker,
        participants = excluded.participants,
        score = excluded.score,
        burst_count = excluded.burst_count
    `);

    this.deleteConversation = this.db.prepare(
      "DELETE FROM active_conversations WHERE channel_id = ?"
    );

    this.getAllConversations = this.db.prepare(
      "SELECT * FROM active_conversations"
    );

    this.getGuildConversations = this.db.prepare(
      "SELECT * FROM active_conversations WHERE guild_id = ?"
    );

    // 会話履歴関連
    this.insertHistory = this.db.prepare(`
      INSERT INTO conversation_history 
      (guild_id, channel_id, score, participants_count, started_at, ended_at, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    console.log("✅ プリペアドステートメント準備完了");
  }

  // === ギルド操作 ===
  
  getGuildData(guildId) {
    return this.getGuild.get(guildId);
  }

  setGuildData(guildId, guildName, totalScore, conversationsCount) {
    this.upsertGuild.run(
      guildId,
      guildName,
      totalScore,
      conversationsCount,
      Date.now()
    );
  }

  addGuildScore(guildId, score) {
    this.incrementGuildScore.run(score, Date.now(), guildId);
  }

  getAllGuilds() {
    return this.db.prepare("SELECT * FROM guilds ORDER BY total_score DESC").all();
  }

  // === 会話操作 ===

  getConversationData(channelId) {
    const row = this.getConversation.get(channelId);
    if (!row) return null;

    // participants を Set に変換
    return {
      guildId: row.guild_id,  // ★ guild_id を guildId にマッピング
      channelId: row.channel_id,
      lastTime: row.last_time,
      lastSpeaker: row.last_speaker,
      participants: new Set(JSON.parse(row.participants)),
      score: row.score,
      burstCount: row.burst_count
    };
  }

  setConversationData(channelId, data) {
    // participants を JSON 文字列に変換
    const participantsJson = JSON.stringify([...data.participants]);
    
    this.upsertConversation.run(
      channelId,
      data.guildId,
      data.lastTime,
      data.lastSpeaker,
      participantsJson,
      data.score,
      data.burstCount
    );
  }

  endConversation(channelId, startTime) {
    const convo = this.getConversationData(channelId);
    if (!convo) return;

    // ★ guildId の存在チェック
    if (!convo.guildId) {
      console.error(`❌ 会話データにguildIdが存在しません: ${channelId}`);
      this.deleteConversation.run(channelId);
      return;
    }

    // 履歴に保存
    const endTime = Date.now();
    this.insertHistory.run(
      convo.guildId,
      channelId,
      convo.score,
      convo.participants.size,
      startTime,
      endTime,
      endTime - startTime
    );

    // ギルドスコアに加算
    this.addGuildScore(convo.guildId, convo.score);

    // 進行中から削除
    this.deleteConversation.run(channelId);
  }

  getAllConversationsData() {
    const rows = this.getAllConversations.all();
    return rows.map(row => ({
      guildId: row.guild_id,
      channelId: row.channel_id,
      lastTime: row.last_time,
      lastSpeaker: row.last_speaker,
      participants: new Set(JSON.parse(row.participants)),
      score: row.score,
      burstCount: row.burst_count
    }));
  }

  getGuildConversationsData(guildId) {
    const rows = this.getGuildConversations.all(guildId);
    return rows.map(row => ({
      guildId: row.guild_id,
      channelId: row.channel_id,
      lastTime: row.last_time,
      lastSpeaker: row.last_speaker,
      participants: new Set(JSON.parse(row.participants)),
      score: row.score,
      burstCount: row.burst_count
    }));
  }

  // === 統計情報 ===

  getGuildStats(guildId) {
    const guild = this.getGuildData(guildId);
    const activeConvos = this.getGuildConversationsData(guildId);
    
    let liveScore = 0;
    for (const convo of activeConvos) {
      liveScore += convo.score;
    }

    return {
      totalScore: guild ? guild.total_score : 0,
      liveScore: liveScore,
      totalWithLive: (guild ? guild.total_score : 0) + liveScore,
      conversationsCount: guild ? guild.conversations_count : 0,
      activeConversations: activeConvos.length
    };
  }

  // === メンテナンス ===

  // 壊れた会話データをクリーンアップ
  cleanupBrokenConversations() {
    const broken = this.db.prepare(
      "SELECT channel_id FROM active_conversations WHERE guild_id IS NULL OR guild_id = ''"
    ).all();

    if (broken.length > 0) {
      console.log(`🧹 壊れた会話データを${broken.length}件削除します...`);
      this.db.prepare("DELETE FROM active_conversations WHERE guild_id IS NULL OR guild_id = ''").run();
    }
  }

  clearAllData() {
    this.db.exec("DELETE FROM guilds");
    this.db.exec("DELETE FROM active_conversations");
    this.db.exec("DELETE FROM conversation_history");
    console.log("🗑️ 全データクリア完了");
  }

  close() {
    this.db.close();
    console.log("📊 データベース接続クローズ");
  }
}


module.exports = BotDatabase;
