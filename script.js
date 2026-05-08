const GITHUB_USER = 'xqr4d';
const GITHUB_REPO = 'Hinata';

const app = document.getElementById('app');

const ID_MAP_KEY = 'hinata_id_map';
const ID_RMAP_KEY = 'hinata_rmap';

function loadMap() {
  try {
    return {
      map: JSON.parse(localStorage.getItem(ID_MAP_KEY) || '{}'),
      rmap: JSON.parse(localStorage.getItem(ID_RMAP_KEY) || '{}'),
    };
  } catch {
    return { map: {}, rmap: {} };
  }
}

function saveMap(map, rmap) {
  localStorage.setItem(ID_MAP_KEY, JSON.stringify(map));
  localStorage.setItem(ID_RMAP_KEY, JSON.stringify(rmap));
}

function generateId() {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++)
    id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function getOrCreateId(tag, file, title) {
  const { map, rmap } = loadMap();
  const key = `${tag}|${file}`;

  if (rmap[key]) return rmap[key];

  let id;
  do {
    id = generateId();
  } while (map[id]);

  map[id] = { tag, file, title };
  rmap[key] = id;
  saveMap(map, rmap);
  return id;
}

function resolveId(id) {
  const { map } = loadMap();
  return map[id] || null;
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
  app.innerHTML = `<div class="video-grid" id="grid">Загрузка библиотеки видео...</div>`;
  const grid = document.getElementById('grid');

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases`
    );
    if (!response.ok) throw new Error('GitHub API error');
    let releases = await response.json();

    releases.sort((a, b) => {
      const dateA = a.published_at || a.created_at || '1970-01-01';
      const dateB = b.published_at || b.created_at || '1970-01-01';
      return new Date(dateB) - new Date(dateA);
    });

    grid.innerHTML = '';
    let hasVideos = false;

    releases.forEach((release) => {
      release.assets.forEach((asset) => {
        if (asset.name.match(/\.(mp4|mov|webm)$/i)) {
          hasVideos = true;

          const thumbAsset = release.assets.find(
            (a) => a.name === 'maxresdefault.jpg'
          );
          const thumbUrl = thumbAsset ? thumbAsset.browser_download_url : null;
          const releaseTitle = release.name || release.tag_name || 'Видео';

          const shortId = getOrCreateId(
            release.tag_name,
            asset.name,
            releaseTitle
          );

          const card = document.createElement('div');
          card.className = 'glass video-card';

          card.innerHTML = `
            <div class="thumbnail-container">
              <div class="thumbnail-loading">ЗАГРУЗКА ОБЛОЖКИ...</div>
              <img class="thumbnail" src="" alt="${asset.name}">
            </div>
            <div style="padding: 15px">
              <p style="margin:0; font-size: 10px;">${releaseTitle}</p>
            </div>
          `;

          renderThumbnail(card, thumbUrl);

          card.addEventListener('click', () => {
            window.location.search = `?v=${shortId}`;
          });
          card.dataset.shortId = shortId;

          grid.appendChild(card);
        }
      });
    });

    if (!hasVideos) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);">В релизах пока нет видеофайлов.</div>`;
    }
  } catch (e) {
    console.error('Ошибка API:', e);
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--accent-primary);">Ошибка загрузки данных с GitHub.<br>${e.message}</div>`;
  }
}

function renderPlayer(videoUrl, releaseName, fileName, shortId) {
  const baseUrl =
    window.location.origin + window.location.pathname.replace('index.html', '');
  const embedParam = shortId || encodeURIComponent(videoUrl);
  const embedUrl = `${baseUrl}embed.html?v=${embedParam}`;
  const embedCode = `<iframe src="${embedUrl}" width="800" height="500" frameborder="0" allowfullscreen style="border-radius:12px; overflow:hidden; border:none;"></iframe>`;

  app.innerHTML = `
    <div class="player-container">
      <div class="glass">
        <video id="v" controls autoplay preload="metadata">
          <source src="${videoUrl}" type="video/mp4">
        </video>
        <div style="padding: 20px 0 10px 0;">
          <p style="margin:0; font-size: 0.95rem; word-break: break-all; text-align:center">
            ${releaseName || 'Без названия'}
          </p>
        </div>
        <div class="controls">
          <button class="btn" id="copyLinkBtn">ССЫЛКА</button>
          <a href="${videoUrl}" target="_blank" class="btn" style="text-decoration:none">СКАЧАТЬ</a>
          <button class="btn" id="copyEmbedBtn">&lt;/&gt; EMBED</button>
        </div>
      </div>
    </div>`;

  const video = document.getElementById('v');
  if (video) video.volume = 0.2;

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
  const shortId = params.get('v');

  if (shortId) {
    const entry = resolveId(shortId);

    if (entry) {
      const videoUrl = buildVideoUrl(entry.tag, entry.file);
      renderPlayer(videoUrl, entry.title, entry.file, shortId);
    } else {
      app.innerHTML = `<div style="text-align:center;padding:60px;color:var(--accent-primary)">Загрузка...</div>`;
      try {
        const response = await fetch(
          `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases`
        );
        if (!response.ok) throw new Error('GitHub API error');
        const releases = await response.json();

        let found = null;
        releases.forEach((release) => {
          release.assets.forEach((asset) => {
            if (asset.name.match(/\.(mp4|mov|webm)$/i)) {
              const releaseTitle = release.name || release.tag_name || 'Видео';
              const id = getOrCreateId(
                release.tag_name,
                asset.name,
                releaseTitle
              );
              if (id === shortId) {
                found = {
                  tag: release.tag_name,
                  file: asset.name,
                  title: releaseTitle,
                };
              }
            }
          });
        });

        if (found) {
          const videoUrl = buildVideoUrl(found.tag, found.file);
          renderPlayer(videoUrl, found.title, found.file, shortId);
        } else {
          app.innerHTML = `<div style="text-align:center;padding:60px;color:var(--accent-primary)">Видео не найдено.<br><a href="index.html" style="color:inherit">← Вернуться</a></div>`;
        }
      } catch (e) {
        app.innerHTML = `<div style="text-align:center;padding:60px;color:var(--accent-primary)">Ошибка загрузки.<br>${e.message}</div>`;
      }
    }
  } else {
    renderGallery();
  }
}

init();
