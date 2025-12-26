const token = process.env.TOKEN || require("./config.json").token;
const { Client, GatewayIntentBits } = require("discord.js");
const BotDatabase = require("./database");

// Webサーバー起動（オプション）
const START_WEB_SERVER = process.env.START_WEB_SERVER === "true";
if (START_WEB_SERVER) {
  require("./web/server");
  console.log("🌐 Webダッシュボード有効化");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== データベース初期化 =====
const db = new BotDatabase();
global.db = db; // コマンド側からアクセス可能に
// ===============================

// デバッグモード
const DEBUG = false;

// 会話開始時刻を追跡（履歴記録用）
const conversationStartTimes = new Map();

client.once("clientReady", () => {
  console.log(`✅ Bot起動完了: ${client.user.tag}`);
  console.log(`📊 ${client.guilds.cache.size}個のサーバーに参加中`);
  
  // 壊れたデータをクリーンアップ
  db.cleanupBrokenConversations();
  
  // 既存ギルドをDBに登録（自動登録）
  for (const guild of client.guilds.cache.values()) {
    let guildData = db.getGuildData(guild.id);
    if (!guildData) {
      db.setGuildData(guild.id, guild.name, 0, 0);
      console.log(`📝 新規サーバー登録: ${guild.name}`);
    } else {
      // サーバー名が変わっている可能性があるので更新
      db.setGuildData(guild.id, guild.name, guildData.total_score, guildData.conversations_count);
    }
  }
  
  console.log(`✅ 全サーバーのDB登録完了`);
});

client.on("messageCreate", (message) => {
  if (message.author.bot || !message.guild) return;

  const channelId = message.channel.id;
  const guildId = message.guild.id;
  const userId = message.author.id;
  const now = Date.now();

  // ギルドがDBに存在しない場合は登録
  let guildData = db.getGuildData(guildId);
  if (!guildData) {
    db.setGuildData(guildId, message.guild.name, 0, 0);
  }

  let convo = db.getConversationData(channelId);

  // 会話データがない場合は新規作成
  if (!convo) {
    const newConvo = {
      guildId: guildId,
      lastTime: now,
      lastSpeaker: userId,
      participants: new Set([userId]),
      score: 1,
      burstCount: 1
    };
    db.setConversationData(channelId, newConvo);
    conversationStartTimes.set(channelId, now);
    
    if (DEBUG) {
      console.log(`[新規会話] ${message.guild.name} #${message.channel.name}`);
    }
    return;
  }

  const FAST_REPLY_SEC = 5;
  const SLOW_REPLY_SEC = 30;
  const diffSec = (now - convo.lastTime) / 1000;

  let timeFactor = 0;
  
  // 時間による会話継続判定
  if (diffSec <= FAST_REPLY_SEC) {
    timeFactor = 1.0;
  } else if (diffSec <= SLOW_REPLY_SEC) {
    timeFactor = 0.25;
  } else {
    // 会話終了 → DB反映
    const startTime = conversationStartTimes.get(channelId) || convo.lastTime;
    db.endConversation(channelId, startTime);
    conversationStartTimes.delete(channelId);

    // 新しい会話開始
    const newConvo = {
      guildId: guildId,
      lastTime: now,
      lastSpeaker: userId,
      participants: new Set([userId]),
      score: 1,
      burstCount: 1
    };
    db.setConversationData(channelId, newConvo);
    conversationStartTimes.set(channelId, now);

    if (DEBUG) {
      console.log(`[会話終了→再開] ${message.guild.name} 最終スコア: ${convo.score.toFixed(2)}`);
    }
    return;
  }

  // スコア計算
  if (userId !== convo.lastSpeaker) {
    // 別ユーザーの発言
    convo.burstCount = 1;
    convo.participants.add(userId);
    convo.score += 1 * timeFactor;
  } else {
    // 同一ユーザーの連投
    convo.burstCount += 1;
    convo.score += (0.2 / convo.burstCount) * timeFactor;
  }

  convo.lastTime = now;
  convo.lastSpeaker = userId;

  // 会話データを保存
  db.setConversationData(channelId, convo);

  if (DEBUG) {
    const stats = db.getGuildStats(guildId);
    console.log(`[会話更新] ${message.guild.name} | チャンネル: ${convo.score.toFixed(2)} | 累計: ${stats.totalScore.toFixed(2)} | 進行中合計: ${stats.liveScore.toFixed(2)}`);
  }
});

// ギルド参加時
// ギルド参加時（既にあるはずですが、なければ追加）
client.on("guildCreate", (guild) => {
  db.setGuildData(guild.id, guild.name, 0, 0);
  console.log(`➕ 新規サーバー参加: ${guild.name} (${guild.memberCount}人)`);
});

// コマンド読み込み
const fs = require("fs");
const path = require("path");

client.commands = new Map();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

for (const file of commandFiles) {
  delete require.cache[require.resolve(`./commands/${file}`)]; // キャッシュクリア
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
  console.log(`📝 コマンド読み込み: /${command.name}`);
}

// インタラクション処理
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ コマンドエラー (/${interaction.commandName}):`, error);
    
    const errorMessage = "⚠️ コマンド実行中にエラーが発生しました";
    
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: errorMessage, flags: 64 }); // flags: 64 = ephemeral
      } else if (interaction.deferred) {
        await interaction.editReply(errorMessage);
      }
    } catch (replyError) {
      console.error("❌ エラー応答に失敗:", replyError.message);
    }
  }
});

// 終了処理
process.on("SIGINT", () => {
  console.log("\n🛑 Bot終了処理開始...");
  
  // 進行中の会話を全て終了
  const allConvos = db.getAllConversationsData();
  for (const convo of allConvos) {
    if (!convo.guildId) {
      console.log(`⚠️ guildIdがない会話をスキップ: ${convo.channelId}`);
      continue;
    }
    const startTime = conversationStartTimes.get(convo.channelId) || convo.lastTime;
    db.endConversation(convo.channelId, startTime);
  }
  
  db.close();
  console.log("👋 Bot終了完了");
  process.exit(0);
});

// Bot起動




