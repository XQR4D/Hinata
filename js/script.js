const GITHUB_USER = 'xqr4d';
const GITHUB_REPO = 'Hinata';

const app = document.getElementById('app');
let firebaseDb = null;
let firebaseUser = null;

function initFirebase() {
  const config = window.HINATA_FIREBASE_CONFIG;
  if (!window.firebase || !config || !config.apiKey || config.apiKey.startsWith('PASTE_')) return Promise.resolve(false);
  try {
    if (!firebase.apps.length) firebase.initializeApp(config);
    firebaseDb = firebase.firestore();
    return firebase.auth().signInAnonymously().then((credential) => {
      firebaseUser = credential.user;
      return true;
    }).catch((error) => {
      console.error('Firebase auth error:', error);
      return false;
    });
  } catch (error) {
    console.error('Firebase init error:', error);
    return Promise.resolve(false);
  }
}

function formatCount(value) {
  return new Intl.NumberFormat('ru-RU').format(value || 0);
}

function setEngagementMessage(message) {
  const status = document.getElementById('engagementStatus');
  if (status) status.textContent = message;
}

function renderComments(snapshot) {
  const list = document.getElementById('commentsList');
  if (!list) return;
  list.innerHTML = '';
  if (snapshot.empty) {
    list.innerHTML = '<div class="comments-empty">КОММЕНТАРИЕВ ПОКА НЕТ</div>';
    return;
  }
  snapshot.forEach((doc) => {
    const comment = doc.data();
    const item = document.createElement('article');
    item.className = 'comment';
    const author = document.createElement('div');
    author.className = 'comment-author';
    author.textContent = comment.name || 'АНОНИМ';
    const text = document.createElement('p');
    text.className = 'comment-text';
    text.textContent = comment.text || '';
    item.append(author, text);
    list.appendChild(item);
  });
}

async function setupEngagement(videoId) {
  const statsRef = firebaseDb.collection('videos').doc(videoId);
  const views = document.getElementById('viewsCount');
  const likes = document.getElementById('likesCount');
  const dislikes = document.getElementById('dislikesCount');
  const viewKey = `hinata-viewed-${videoId}`;

  statsRef.onSnapshot((snapshot) => {
    const stats = snapshot.data() || {};
    views.textContent = formatCount(stats.views);
    likes.textContent = formatCount(stats.likes);
    dislikes.textContent = formatCount(stats.dislikes);
  }, (error) => {
    console.error('Firebase stats error:', error);
    setEngagementMessage('СТАТИСТИКА ВРЕМЕННО НЕДОСТУПНА');
  });

  if (!localStorage.getItem(viewKey)) {
    await statsRef.set({ views: firebase.firestore.FieldValue.increment(1) }, { merge: true });
    localStorage.setItem(viewKey, '1');
  }

  document.querySelectorAll('[data-vote]').forEach((button) => {
    button.addEventListener('click', async () => {
      const vote = button.dataset.vote;
      const voteRef = statsRef.collection('votes').doc(firebaseUser.uid);
      button.disabled = true;
      try {
        await firebaseDb.runTransaction(async (transaction) => {
          const voteSnapshot = await transaction.get(voteRef);
          const previousVote = voteSnapshot.exists ? voteSnapshot.data().type : null;
          if (previousVote === vote) return;
          const update = {};
          if (previousVote) update[previousVote === 'like' ? 'likes' : 'dislikes'] = firebase.firestore.FieldValue.increment(-1);
          update[vote === 'like' ? 'likes' : 'dislikes'] = firebase.firestore.FieldValue.increment(1);
          transaction.set(statsRef, update, { merge: true });
          transaction.set(voteRef, { type: vote });
        });
      } catch (error) {
        console.error('Firebase vote error:', error);
        setEngagementMessage('НЕ УДАЛОСЬ СОХРАНИТЬ ГОЛОС');
      } finally {
        button.disabled = false;
      }
    });
  });

  const commentsRef = statsRef.collection('comments');
  commentsRef.orderBy('createdAt', 'desc').limit(50).onSnapshot(renderComments, (error) => {
    console.error('Firebase comments error:', error);
    setEngagementMessage('КОММЕНТАРИИ ВРЕМЕННО НЕДОСТУПНЫ');
  });

  document.getElementById('commentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const nameInput = document.getElementById('commentName');
    const textInput = document.getElementById('commentText');
    const submit = event.target.querySelector('button');
    const name = nameInput.value.trim().slice(0, 40);
    const text = textInput.value.trim().slice(0, 1000);
    if (!name || !text) return;
    submit.disabled = true;
    try {
      await commentsRef.add({ name, text, uid: firebaseUser.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      textInput.value = '';
    } catch (error) {
      console.error('Firebase comment error:', error);
      setEngagementMessage('НЕ УДАЛОСЬ ОПУБЛИКОВАТЬ КОММЕНТАРИЙ');
    } finally {
      submit.disabled = false;
    }
  });
}

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
        <video id="v" autoplay preload="metadata" playsinline>
          <source src="${videoUrl}" type="video/mp4">
        </video>

        <div class="progress-bar-wrap" id="progressWrap">
          <div class="progress-bar-fill" id="progressFill"></div>
          <div class="progress-bar-dot" id="progressDot"></div>
        </div>

        <div class="video-controls" aria-label="Управление видео">
          <button class="video-control-button" id="playPauseBtn" type="button" aria-label="Воспроизвести" title="Воспроизвести">▶</button>
          <span class="video-time"><span id="currentTime">0:00</span> / <span id="duration">0:00</span></span>
          <label class="volume-control" title="Громкость">
            <span id="volumeLevel" aria-hidden="true">VOL 20%</span>
            <input id="volumeControl" type="range" min="0" max="1" step="0.01" value="0.2" aria-label="Громкость">
          </label>
          <button class="video-control-button fullscreen-button" id="fullscreenBtn" type="button" aria-label="Полный экран" title="Полный экран">FULL</button>
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
      <section class="engagement" aria-label="Статистика и комментарии">
        <div class="engagement-stats">
          <span class="stat"><strong id="viewsCount">0</strong> ПРОСМОТРОВ</span>
          <button class="vote-button" data-vote="like" type="button">НРАВИТСЯ <strong id="likesCount">0</strong></button>
          <button class="vote-button" data-vote="dislike" type="button">НЕ НРАВИТСЯ <strong id="dislikesCount">0</strong></button>
        </div>
        <div id="engagementStatus" class="engagement-status"></div>
        <div class="comments">
          <h2>КОММЕНТАРИИ</h2>
          <form id="commentForm" class="comment-form">
            <input id="commentName" maxlength="40" placeholder="ИМЯ" required />
            <textarea id="commentText" maxlength="1000" rows="3" placeholder="ВАШ КОММЕНТАРИЙ" required></textarea>
            <button class="btn" type="submit">ОТПРАВИТЬ</button>
          </form>
          <div id="commentsList" class="comments-list"><div class="comments-empty">ЗАГРУЗКА КОММЕНТАРИЕВ...</div></div>
        </div>
      </section>
    </div>`;

  const video = document.getElementById('v');
  const fill = document.getElementById('progressFill');
  const dot = document.getElementById('progressDot');
  const wrap = document.getElementById('progressWrap');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const currentTime = document.getElementById('currentTime');
  const duration = document.getElementById('duration');
  const volumeControl = document.getElementById('volumeControl');
  const volumeLevel = document.getElementById('volumeLevel');
  const fullscreenBtn = document.getElementById('fullscreenBtn');

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainingSeconds}`;
  };

  const updatePlayButton = () => {
    const isPlaying = !video.paused && !video.ended;
    playPauseBtn.textContent = isPlaying ? 'Ⅱ' : '▶';
    playPauseBtn.setAttribute('aria-label', isPlaying ? 'Пауза' : 'Воспроизвести');
    playPauseBtn.title = isPlaying ? 'Пауза' : 'Воспроизвести';
  };

  const updateVolume = (value) => {
    const nextVolume = Math.min(1, Math.max(0, value));
    video.volume = nextVolume;
    video.muted = nextVolume === 0;
    volumeControl.value = nextVolume.toString();
    volumeLevel.textContent = `VOL ${Math.round(nextVolume * 100)}%`;
  };

  if (video) {
    updateVolume(Number(volumeControl.value));

    playPauseBtn.addEventListener('click', () => {
      if (video.paused) video.play();
      else video.pause();
    });

    volumeControl.addEventListener('input', () => {
      updateVolume(Number(volumeControl.value));
    });

    fullscreenBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.querySelector('.player-glass').requestFullscreen();
    });

    video.addEventListener('timeupdate', () => {
      if (!video.duration) return;
      const pct = (video.currentTime / video.duration) * 100;
      fill.style.width = pct + '%';
      dot.style.left = pct + '%';
      currentTime.textContent = formatTime(video.currentTime);
    });

    video.addEventListener('loadedmetadata', () => {
      duration.textContent = formatTime(video.duration);
    });
    video.addEventListener('play', updatePlayButton);
    video.addEventListener('pause', updatePlayButton);
    video.addEventListener('ended', updatePlayButton);

    wrap.addEventListener('click', (e) => {
      if (!video.duration) return;
      const rect = wrap.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      video.currentTime = pct * video.duration;
    });

    document.addEventListener('keydown', (event) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement || target.isContentEditable) return;

      if (event.code === 'Space' || event.code === 'KeyK') {
        event.preventDefault();
        if (video.paused) video.play().catch(() => {});
        else video.pause();
      } else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        event.preventDefault();
        if (!Number.isFinite(video.duration)) return;
        const change = event.code === 'ArrowLeft' ? -5 : 5;
        video.currentTime = Math.min(video.duration, Math.max(0, video.currentTime + change));
      } else if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        event.preventDefault();
        const currentVolume = video.muted ? 0 : video.volume;
        const change = event.code === 'ArrowUp' ? 0.1 : -0.1;
        updateVolume(currentVolume + change);
      } else if (event.code === 'KeyM') {
        event.preventDefault();
        video.muted = !video.muted;
        if (!video.muted && video.volume === 0) {
          updateVolume(0.2);
        } else {
          volumeLevel.textContent = `VOL ${video.muted ? 0 : Math.round(video.volume * 100)}%`;
        }
      } else if (event.code === 'KeyF') {
        event.preventDefault();
        if (document.fullscreenElement) document.exitFullscreen();
        else document.querySelector('.player-glass').requestFullscreen().catch(() => {});
      }
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

  if (shortId) {
    initFirebase().then((enabled) => {
      if (enabled) setupEngagement(shortId);
      else setEngagementMessage('FIREBASE ЕЩЁ НЕ НАСТРОЕН');
    });
  }
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
