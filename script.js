const GITHUB_USER = 'xqr4d';
const GITHUB_REPO = 'Hinata';

const app = document.getElementById('app');

async function makeId(tag, file) {
  const str = `${tag}|${file}`;
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str)
  );
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map((b) => chars[b % chars.length])
    .join('');
}

async function fetchAllReleases() {
  let page = 1,
    all = [];
  while (true) {
    const r = await fetch(
      `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases?per_page=100&page=${page}`
    );
    if (!r.ok) throw new Error('GitHub API error');
    const batch = await r.json();
    if (!batch.length) break;
    all = all.concat(batch);
    if (batch.length < 100) break;
    page++;
  }
  return all;
}

async function resolveId(shortId) {
  const releases = await fetchAllReleases();
  for (const release of releases) {
    for (const asset of release.assets) {
      if (asset.name.match(/\.(mp4|mov|webm)$/i)) {
        const id = await makeId(release.tag_name, asset.name);
        if (id === shortId)
          return {
            tag: release.tag_name,
            file: asset.name,
            title: release.name || release.tag_name || 'Видео',
          };
      }
    }
  }
  return null;
}

function buildVideoUrl(tag, file) {
  return `https://github.com/${GITHUB_USER}/${GITHUB_REPO}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(file)}`;
}

function renderThumbnail(card, thumbUrl) {
  const img = card.querySelector('.thumbnail');
  const loading = card.querySelector('.thumbnail-loading');
  if (thumbUrl) {
    img.src = thumbUrl;
    img.style.display = 'block';
    if (loading) loading.remove();
  } else {
    if (loading) {
      loading.classList.add('thumbnail-error');
      loading.textContent = 'ПРЕВЬЮ НЕДОСТУПНО';
    }
    img.style.display = 'none';
  }
}

async function renderGallery() {
  app.innerHTML = `<div class="video-grid" id="grid"><div class="state-msg">ЗАГРУЗКА ВИДЕО...</div></div>`;
  const grid = document.getElementById('grid');

  try {
    let releases = await fetchAllReleases();
    releases.sort(
      (a, b) =>
        new Date(b.published_at || b.created_at || 0) -
        new Date(a.published_at || a.created_at || 0)
    );

    grid.innerHTML = '';
    let hasVideos = false;

    for (const release of releases) {
      for (const asset of release.assets) {
        if (asset.name.match(/\.(mp4|mov|webm)$/i)) {
          hasVideos = true;
          const thumbAsset = release.assets.find(
            (a) => a.name === 'maxresdefault.jpg'
          );
          const thumbUrl = thumbAsset ? thumbAsset.browser_download_url : null;
          const releaseTitle = release.name || release.tag_name || 'Видео';
          const shortId = await makeId(release.tag_name, asset.name);
          const rawDate = release.published_at || release.created_at;
          const releaseDate = rawDate
            ? new Date(rawDate).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : '';

          const card = document.createElement('div');
          card.className = 'glass video-card';
          card.innerHTML = `
            <div class="thumbnail-container">
              <div class="thumbnail-loading">ЗАГРУЗКА ОБЛОЖКИ...</div>
              <img class="thumbnail" src="" alt="${asset.name}">
            </div>
            <div style="padding: 12px 14px 14px; border-top: 1px solid #1a1a1a;">
              <p style="margin:0; padding:0; font-size:10px; color:#ddd; text-transform:uppercase; letter-spacing:0.5px; line-height:1.5;">${releaseTitle}</p>
              ${releaseDate ? `<p style="margin:5px 0 0; padding:0; font-size:8px; color:var(--accent-primary); letter-spacing:2px; text-transform:uppercase; opacity:0.8;">${releaseDate}</p>` : ''}
            </div>
          `;

          renderThumbnail(card, thumbUrl);
          card.addEventListener('click', () => {
            window.location.search = `?v=${shortId}`;
          });
          grid.appendChild(card);
        }
      }
    }

    if (!hasVideos)
      grid.innerHTML = `<div class="state-msg">В РЕЛИЗАХ НЕТ ВИДЕОФАЙЛОВ</div>`;
  } catch (e) {
    console.error(e);
    grid.innerHTML = `<div class="state-msg">ОШИБКА ЗАГРУЗКИ<br><span style="font-size:9px;color:#555">${e.message}</span></div>`;
  }
}

function renderPlayer(videoUrl, releaseName, releaseDate, shortId) {
  const baseUrl =
    window.location.origin + window.location.pathname.replace('index.html', '');
  const embedParam = shortId || encodeURIComponent(videoUrl);
  const embedUrl = `${baseUrl}embed.html?v=${embedParam}`;
  const embedCode = `<iframe src="${embedUrl}" width="800" height="500" frameborder="0" allowfullscreen style="overflow:hidden; border:none;"></iframe>`;

  const dateStr = releaseDate
    ? new Date(releaseDate).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  app.innerHTML = `
    <div class="player-container">
      <div class="player-glass">
        <video id="v" controls autoplay preload="metadata">
          <source src="${videoUrl}" type="video/mp4">
        </video>

        <div class="progress-bar-wrap" id="progressWrap">
          <div class="progress-bar-fill" id="progressFill"></div>
          <div class="progress-bar-dot" id="progressDot"></div>
        </div>

        <div class="player-bottom">
          <div class="player-title-block">
            <div class="player-title">${releaseName || 'БЕЗ НАЗВАНИЯ'}</div>
            ${dateStr ? `<div class="player-date">${dateStr}</div>` : ''}
          </div>
          <div class="controls">
            <button class="btn" id="copyLinkBtn">ССЫЛКА</button>
            <a href="${videoUrl}" target="_blank" class="btn">СКАЧАТЬ</a>
            <button class="btn btn-embed" id="copyEmbedBtn">&lt;/&gt; EMBED</button>
          </div>
        </div>
      </div>
    </div>`;

  const video = document.getElementById('v');
  const fill = document.getElementById('progressFill');
  const dot = document.getElementById('progressDot');
  const wrap = document.getElementById('progressWrap');

  if (video) {
    video.volume = 0.2;

    video.addEventListener('timeupdate', () => {
      if (!video.duration) return;
      const pct = (video.currentTime / video.duration) * 100;
      fill.style.width = pct + '%';
      dot.style.left = pct + '%';
    });

    wrap.addEventListener('click', (e) => {
      if (!video.duration) return;
      const rect = wrap.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      video.currentTime = pct * video.duration;
    });
  }

  document.getElementById('copyLinkBtn').onclick = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => alert('Ссылка скопирована'));
  };
  document.getElementById('copyEmbedBtn').onclick = () => {
    navigator.clipboard
      .writeText(embedCode)
      .then(() => alert('Код embed скопирован'));
  };
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const v = params.get('v');

  if (v) {
    if (v.startsWith('http')) {
      const title = params.get('t') || params.get('n') || 'Video';
      renderPlayer(v, title, null, null);
    } else {
      app.innerHTML = `<div class="state-msg">ЗАГРУЗКА...</div>`;
      try {
        const entry = await resolveId(v);
        if (entry) {
          const videoUrl = buildVideoUrl(entry.tag, entry.file);
          renderPlayer(videoUrl, entry.title, entry.date, v);
        } else {
          app.innerHTML = `<div class="state-msg">ВИДЕО НЕ НАЙДЕНО<br><a href="index.html" style="color:var(--accent-primary);font-size:9px;letter-spacing:2px;">← НАЗАД</a></div>`;
        }
      } catch (e) {
        app.innerHTML = `<div class="state-msg">ОШИБКА<br><span style="font-size:9px;color:#555">${e.message}</span></div>`;
      }
    }
  } else {
    renderGallery();
  }
}

init();
