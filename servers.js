async function loadServers() {
  const res = await fetch("/api/servers");
  const result = await res.json();

  if (!result.success) return;

  const container = document.getElementById("servers");
  container.innerHTML = "";

  result.data.forEach(guild => {
    const div = document.createElement("div");
    div.textContent = guild.guild_name;
    container.appendChild(div);
  });
}
app.get("/api/servers", (req, res) => {
  try {
    const guilds = db.getAllGuilds();
    res.json({
      success: true,
      data: guilds
    });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});


loadServers();
