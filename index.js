// 統計情報を読み込み
async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    const result = await response.json();
    
    if (result.success) {
      document.getElementById('totalGuilds').textContent = result.data.totalGuilds;
      document.getElementById('totalScore').textContent = result.data.totalScore.toFixed(0);
      document.getElementById('totalConversations').textContent = result.data.totalConversations;
      document.getElementById('activeConversations').textContent = result.data.activeConversations;
    }
  } catch (error) {
    console.error('Stats loading error:', error);
  }
}

// ランキングを読み込み（上位5件）
async function loadRanking() {
  const container = document.getElementById('rankingContainer');
  
  try {
    const response = await fetch('/api/ranking');
    const result = await response.json();
    
    if (!result.success || result.data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>まだランキングデータがありません</p>
        </div>
      `;
      return;
    }

    const ranking = result.data.slice(0, 5); // 上位5件
    let html = '<div class="ranking-list">';

    ranking.forEach((guild, index) => {
      const rank = index + 1;
      let rankClass = '';
      let medal = '';

      if (rank === 1) {
        rankClass = 'rank-gold';
        medal = '🥇';
      } else if (rank === 2) {
        rankClass = 'rank-silver';
        medal = '🥈';
      } else if (rank === 3) {
        rankClass = 'rank-bronze';
        medal = '🥉';
      }

      const liveBadge = guild.liveScore > 0 ? ' 🔥' : '';

      html += `
        <div class="rank-item">
          <div class="rank-left">
            <div class="rank-number ${rankClass}">${medal || rank}</div>
            <div class="rank-info">
              <h3>${escapeHtml(guild.guildName)}</h3>
              <div class="rank-meta">
                完了: ${guild.conversationsCount}回 ${guild.activeConversations > 0 ? `| 進行中: ${guild.activeConversations}個` : ''}
              </div>
            </div>
          </div>
          <div class="rank-right">
            <div class="rank-score">${guild.score.toFixed(1)}${liveBadge}</div>
            <div class="rank-label">スコア</div>
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;

  } catch (error) {
    console.error('Ranking loading error:', error);
    container.innerHTML = `
      <div class="empty-state">
        <p>エラーが発生しました</p>
      </div>
    `;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 初回読み込み
loadStats();
loadRanking();

// 30秒ごとに自動更新
setInterval(() => {
  loadStats();
  loadRanking();
}, 30000);