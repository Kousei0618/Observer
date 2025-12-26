const { REST, Routes } = require("discord.js");
const { clientId, token } = require("./config.json");

const commands = [
  {
    name: "ranking",
    description: "サーバーの会話ランキングを表示します"
  }
];

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log("🌍 グローバルコマンド登録中...");

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    console.log("✅ グローバルコマンド登録完了！");
  } catch (error) {
    console.error(error);
  }
})();
