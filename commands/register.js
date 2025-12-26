const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const crypto = require("crypto");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("register")
    .setDescription("このサーバーをWebサイトに登録します（管理者専用）")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("招待リンクを作成するチャンネル")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const db = global.db;
    const guildId = interaction.guild.id;
    const channel = interaction.options.getChannel("channel");

    // 権限チェック
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.editReply({
        content: "❌ このコマンドは管理者のみ実行できます。"
      });
    }

    try {
      // 招待リンク作成
      const invite = await channel.createInvite({
        maxAge: 0, // 無期限
        maxUses: 0, // 無制限
        reason: "Webサイト登録用の招待リンク"
      });

      // 登録トークン生成（6桁の英数字）
      const token = crypto.randomBytes(3).toString("hex").toUpperCase();
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24時間有効

      // DBに保存
      const registration = {
        guildId: guildId,
        guildName: interaction.guild.name,
        inviteUrl: invite.url,
        channelId: channel.id,
        channelName: channel.name,
        token: token,
        createdBy: interaction.user.id,
        createdAt: Date.now(),
        expiresAt: expiresAt,
        status: "pending" // pending, completed
      };

      db.saveRegistration(registration);

      // 成功メッセージ
      const embed = {
        color: 0x5865F2,
        title: "✅ サーバー登録を開始しました",
        description: "以下の手順でWebサイトへの登録を完了してください。",
        fields: [
          {
            name: "1️⃣ Webサイトにアクセス",
            value: `[こちらをクリック](http://localhost:3000/register)\n（Bot起動中のURLに置き換えてください）`
          },
          {
            name: "2️⃣ Discordでログイン",
            value: "サイト上でDiscordアカウントでログインしてください"
          },
          {
            name: "3️⃣ 登録トークンを入力",
            value: `\`\`\`\n${token}\n\`\`\`\n**このトークンは24時間有効です**`
          },
          {
            name: "4️⃣ サーバー情報を入力",
            value: "紹介文・タグ・画像などを設定して公開します"
          }
        ],
        footer: {
          text: "登録が完了すると、Webサイトにサーバーが表示されます"
        },
        timestamp: new Date().toISOString()
      };

      await interaction.editReply({ embeds: [embed] });

      // 登録チャンネルに通知（オプション）
      try {
        await channel.send({
          content: `🎉 このサーバーがWebサイトへの登録を開始しました！\n管理者が登録を完了すると、ここに招待リンクが表示されます。`,
        });
      } catch (error) {
        console.log("チャンネル通知失敗（権限不足の可能性）");
      }

    } catch (error) {
      console.error("Registration error:", error);
      await interaction.editReply({
        content: `❌ 登録処理中にエラーが発生しました。\n\`\`\`\n${error.message}\n\`\`\``
      });
    }
  }
};
