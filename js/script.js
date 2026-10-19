const GITHUB_USER = "xqr4d";
const GITHUB_REPO = "Hinata";
const PLAYER_VOLUME_STORAGE_KEY = "hinata-volume";
const LEGACY_PLAYER_VOLUME_STORAGE_KEY = "hinata-player-volume";
const DEFAULT_VOLUME = 0.2;

const ICONS = {
  play: `<svg class="icon icon-fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7L8 5z"/></svg>`,
  pause: `<svg class="icon icon-fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z"/></svg>`,
  fullscreen: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>`,
  link: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  download: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M5 19h14"/></svg>`,
  embed: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6l-5 6 5 6M16 6l5 6-5 6"/></svg>`,
  like: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3zm0 0 4.5-7.5A2.5 2.5 0 0 1 14 5v3h5.2a2 2 0 0 1 1.96 2.38l-1.4 8A2 2 0 0 1 17.8 21H7"/></svg>`,
  dislike: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 13V3h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3zm0 0-4.5 7.5A2.5 2.5 0 0 1 10 19v-3H4.8a2 2 0 0 1-1.96-2.38l1.4-8A2 2 0 0 1 6.2 3H17"/></svg>`,
  send: `<svg class="icon icon-fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 21 3l-7.5 18-2-7.5L3 11.5z"/></svg>`,
};

const app = document.getElementById("app");
let firebaseDb = null;
let firebaseUser = null;

function initFirebase() {
  const config = window.HINATA_FIREBASE_CONFIG;
  if (
    !window.firebase ||
    !config ||
    !config.apiKey ||
    config.apiKey.startsWith("PASTE_")
  )
    return Promise.resolve(false);
  try {
    if (!firebase.apps.length) firebase.initializeApp(config);
    firebaseDb = firebase.firestore();
    return firebase
      .auth()
      .signInAnonymously()
      .then((credential) => {
        firebaseUser = credential.user;
        return true;
      })
      .catch((error) => {
        console.error("Firebase auth error:", error);
        return false;
      });
  } catch (error) {
    console.error("Firebase init error:", error);
    return Promise.resolve(false);
  }
}

function formatCount(value) {
  return new Intl.NumberFormat("ru-RU").format(value || 0);
}

function setEngagementMessage(message) {
  const status = document.getElementById("engagementStatus");
  if (status) status.textContent = message;
}

function renderComments(snapshot) {
  const list = document.getElementById("commentsList");
  if (!list) return;
  list.innerHTML = "";
  if (snapshot.empty) {
    list.innerHTML = '<div class="comments-empty">КОММЕНТАРИЕВ ПОКА НЕТ</div>';
    return;
  }
  snapshot.forEach((doc) => {
    const comment = doc.data();
    const item = document.createElement("article");
    item.className = "comment";
    const author = document.createElement("div");
    author.className = "comment-author";
    author.textContent = comment.name || "АНОНИМ";
    const text = document.createElement("p");
    text.className = "comment-text";
    text.textContent = comment.text || "";
    item.append(author, text);
    list.appendChild(item);
  });
}

async function setupEngagement(videoId) {
  const statsRef = firebaseDb.collection("videos").doc(videoId);
  const views = document.getElementById("viewsCount");
  const likes = document.getElementById("likesCount");
  const dislikes = document.getElementById("dislikesCount");
  const viewKey = `hinata-viewed-${videoId}`;

  statsRef.onSnapshot(
    (snapshot) => {
      const stats = snapshot.data() || {};
      views.textContent = formatCount(stats.views);
      likes.textContent = formatCount(stats.likes);
      dislikes.textContent = formatCount(stats.dislikes);
    },
    (error) => {
      console.error("Firebase stats error:", error);
      setEngagementMessage("СТАТИСТИКА ВРЕМЕННО НЕДОСТУПНА");
    },
  );

  if (!localStorage.getItem(viewKey)) {
    await statsRef.set(
      { views: firebase.firestore.FieldValue.increment(1) },
      { merge: true },
    );
    localStorage.setItem(viewKey, "1");
  }

  document.querySelectorAll("[data-vote]").forEach((button) => {
    button.addEventListener("click", async () => {
      const vote = button.dataset.vote;
      const voteRef = statsRef.collection("votes").doc(firebaseUser.uid);
      button.disabled = true;
      try {
        await firebaseDb.runTransaction(async (transaction) => {
          const voteSnapshot = await transaction.get(voteRef);
          const previousVote = voteSnapshot.exists
            ? voteSnapshot.data().type
            : null;
          if (previousVote === vote) return;
          const update = {};
          if (previousVote)
            update[previousVote === "like" ? "likes" : "dislikes"] =
              firebase.firestore.FieldValue.increment(-1);
          update[vote === "like" ? "likes" : "dislikes"] =
            firebase.firestore.FieldValue.increment(1);
          transaction.set(statsRef, update, { merge: true });
          transaction.set(voteRef, { type: vote });
        });
      } catch (error) {
        console.error("Firebase vote error:", error);
        setEngagementMessage("НЕ УДАЛОСЬ СОХРАНИТЬ ГОЛОС");
      } finally {
        button.disabled = false;
      }
    });
  });

  const commentsRef = statsRef.collection("comments");
  commentsRef
    .orderBy("createdAt", "desc")
    .limit(50)
    .onSnapshot(renderComments, (error) => {
      console.error("Firebase comments error:", error);
      setEngagementMessage("КОММЕНТАРИИ ВРЕМЕННО НЕДОСТУПНЫ");
    });

  const textInput = document.getElementById("commentText");
  const textWrap = document.getElementById("commentTextWrap");
  const syncTextWrap = () => {
    if (!textWrap) return;
    textWrap.classList.toggle("has-value", Boolean(textInput.value.trim()));
  };
  if (textInput) {
    textInput.addEventListener("input", syncTextWrap);
    syncTextWrap();
  }

  document
    .getElementById("commentForm")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const nameInput = document.getElementById("commentName");
      const submit = event.target.querySelector("button");
      const name = nameInput.value.trim().slice(0, 40);
      const text = textInput.value.trim().slice(0, 1000);
      if (!name || !text) return;
      submit.disabled = true;
      try {
        await commentsRef.add({
          name,
          text,
          uid: firebaseUser.uid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        textInput.value = "";
        syncTextWrap();
      } catch (error) {
        console.error("Firebase comment error:", error);
        setEngagementMessage("НЕ УДАЛОСЬ ОПУБЛИКОВАТЬ КОММЕНТАРИЙ");
      } finally {
        submit.disabled = false;
      }
    });
}

async function makeId(tag, file) {
  const str = `${tag}|${file}`;
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str),
  );
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map((b) => chars[b % chars.length])
    .join("");
}

async function getAllVideoEntries() {
  const releases = await fetchAllReleases();
  releases.sort(
    (a, b) =>
      new Date(b.published_at || b.created_at || 0) -
      new Date(a.published_at || a.created_at || 0),
  );
  const entries = [];
  for (const release of releases) {
    for (const asset of release.assets) {
      if (asset.name.match(/\.(mp4|mov|webm)$/i)) {
        const thumbAsset = release.assets.find(
          (a) => a.name === "maxresdefault.jpg",
        );
        const shortId = await makeId(release.tag_name, asset.name);
        const rawDate = release.published_at || release.created_at;
        entries.push({
          id: shortId,
          tag: release.tag_name,
          file: asset.name,
          title: release.name || release.tag_name || "Видео",
          date: rawDate || null,
          thumbUrl: thumbAsset ? thumbAsset.browser_download_url : null,
          description: (release.body || "").trim(),
        });
      }
    }
  }
  return entries;
}

async function fetchAllReleases() {
  let page = 1,
    all = [];
  while (true) {
    const r = await fetch(
      `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases?per_page=100&page=${page}`,
    );
    if (!r.ok) throw new Error("GitHub API error");
    const batch = await r.json();
    if (!batch.length) break;
    all = all.concat(batch);
    if (batch.length < 100) break;
    page++;
  }
  return all;
}

async function resolveId(shortId) {
  const entries = await getAllVideoEntries();
  return entries.find((e) => e.id === shortId) || null;
}

function buildVideoUrl(tag, file) {
  return `https://github.com/${GITHUB_USER}/${GITHUB_REPO}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(file)}`;
}

function renderThumbnail(card, thumbUrl) {
  const img = card.querySelector(".thumbnail");
  const loading = card.querySelector(".thumbnail-loading");
  if (thumbUrl) {
    img.src = thumbUrl;
    img.style.display = "block";
    if (loading) loading.remove();
  } else {
    if (loading) {
      loading.classList.add("thumbnail-error");
      loading.textContent = "ПРЕВЬЮ НЕДОСТУПНО";
    }
    img.style.display = "none";
  }
}

async function renderGallery() {
  app.innerHTML = `<div class="video-grid" id="grid"><div class="state-msg">ЗАГРУЗКА ВИДЕО...</div></div>`;
  const grid = document.getElementById("grid");

  try {
    let releases = await fetchAllReleases();
    releases.sort(
      (a, b) =>
        new Date(b.published_at || b.created_at || 0) -
        new Date(a.published_at || a.created_at || 0),
    );

    grid.innerHTML = "";
    let hasVideos = false;

    for (const release of releases) {
      for (const asset of release.assets) {
        if (asset.name.match(/\.(mp4|mov|webm)$/i)) {
          hasVideos = true;
          const thumbAsset = release.assets.find(
            (a) => a.name === "maxresdefault.jpg",
          );
          const thumbUrl = thumbAsset ? thumbAsset.browser_download_url : null;
          const releaseTitle = release.name || release.tag_name || "Видео";
          const shortId = await makeId(release.tag_name, asset.name);
          const rawDate = release.published_at || release.created_at;
          const releaseDate = rawDate
            ? new Date(rawDate).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : "";

          const card = document.createElement("div");
          card.className = "glass video-card";
          card.innerHTML = `
            <div class="thumbnail-container">
              <div class="thumbnail-loading">ЗАГРУЗКА ОБЛОЖКИ...</div>
              <img class="thumbnail" src="" alt="${asset.name}">
            </div>
            <div style="padding: 12px 14px 14px; border-top: 1px solid #1a1a1a;">
              <p style="margin:0; padding:0; font-size:10px; color:#ddd; text-transform:uppercase; letter-spacing:0.5px; line-height:1.5;">${releaseTitle}</p>
              ${releaseDate ? `<p style="margin:5px 0 0; padding:0; font-size:8px; color:var(--accent-primary); letter-spacing:2px; text-transform:uppercase; opacity:0.8;">${releaseDate}</p>` : ""}
            </div>
          `;

          renderThumbnail(card, thumbUrl);
          card.addEventListener("click", () => {
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDescription(raw) {
  if (!raw) return "";
  let text = escapeHtml(raw);
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  text = text.replace(
    /(?<!["'>])(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  text = text.replace(/\r\n|\r|\n/g, "<br>");
  return text;
}

function buildSideCard(entry, label) {
  if (!entry) {
    return `
      <div class="player-side player-side-empty">
        <div class="side-empty-label">${label || ""}</div>
      </div>`;
  }
  const dateStr = entry.date
    ? new Date(entry.date).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
  const thumb = entry.thumbUrl
    ? `<img class="side-thumb" src="${entry.thumbUrl}" alt="" loading="lazy">`
    : `<div class="side-thumb-placeholder">НЕТ ПРЕВЬЮ</div>`;
  return `
    <a class="player-side player-side-card" href="?v=${entry.id}" title="${entry.title}">
      <div class="side-label">${label}</div>
      <div class="side-thumb-wrap">${thumb}</div>
      <div class="side-info">
        <div class="side-title">${entry.title}</div>
        ${dateStr ? `<div class="side-date">${dateStr}</div>` : ""}
      </div>
    </a>`;
}

function renderPlayer(
  videoUrl,
  releaseName,
  releaseDate,
  shortId,
  prevEntry,
  nextEntry,
  description,
  thumbnailUrl,
) {
  const baseUrl =
    window.location.origin + window.location.pathname.replace("index.html", "");
  const embedParam = shortId || encodeURIComponent(videoUrl);
  const embedUrl = `${baseUrl}embed.html?v=${embedParam}`;
  const embedCode = `<iframe src="${embedUrl}" width="800" height="500" frameborder="0" allowfullscreen style="overflow:hidden; border:none;"></iframe>`;

  const dateStr = releaseDate
    ? new Date(releaseDate).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const leftHtml = prevEntry
    ? buildSideCard(prevEntry, "← ПРЕДЫДУЩИЙ")
    : buildSideCard(null, "");
  const rightHtml = nextEntry
    ? buildSideCard(nextEntry, "СЛЕДУЮЩИЙ →")
    : buildSideCard(null, "РЕКОМЕНДУЕМ К ПРОСМОТРУ");

  app.innerHTML = `
    <div class="player-layout">
      ${leftHtml}
      <div class="player-container">
        <div class="player-glass">
          <div class="player-video-wrapper">
            <video id="v" preload="metadata" playsinline>
              <source src="${videoUrl}" type="video/mp4">
            </video>

            <div class="player-preview" id="playerPreview">
              ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="" />` : ""}
              <button class="player-start-button" id="playerStartBtn" type="button" aria-label="Начать воспроизведение" title="Начать воспроизведение">
                ${ICONS.play}
              </button>
            </div>

            <div class="progress-bar-wrap" id="progressWrap">
              <div class="progress-bar-fill" id="progressFill"></div>
              <div class="progress-bar-dot" id="progressDot"></div>
            </div>

            <div class="video-controls" aria-label="Управление видео">
              <button class="video-control-button" id="playPauseBtn" type="button" aria-label="Воспроизвести" title="Воспроизвести">${ICONS.play}</button>
              <span class="video-time"><span id="currentTime">0:00</span> / <span id="duration">0:00</span></span>
              <label class="volume-control" title="Громкость">
                <span id="volumeLevel" aria-hidden="true">VOL 20%</span>
                <input id="volumeControl" type="range" min="0" max="1" step="0.01" value="0.2" aria-label="Громкость">
              </label>
              <button class="video-control-button fullscreen-button" id="fullscreenBtn" type="button" aria-label="Полный экран" title="Полный экран">${ICONS.fullscreen}<span>FULL</span></button>
            </div>
          </div>

          <div class="player-bottom">
            <div class="player-title-block">
              <div class="player-title">${releaseName || "БЕЗ НАЗВАНИЯ"}</div>
              ${dateStr ? `<div class="player-date">${dateStr}</div>` : ""}
              ${description ? `<div class="player-description">${formatDescription(description)}</div>` : ""}
            </div>
            <div class="controls">
              <button class="btn" id="copyLinkBtn">${ICONS.link} ССЫЛКА</button>
              <a href="${videoUrl}" target="_blank" class="btn">${ICONS.download} СКАЧАТЬ</a>
              <button class="btn btn-embed" id="copyEmbedBtn">${ICONS.embed} EMBED</button>
            </div>
          </div>
        </div>
        <section class="engagement" aria-label="Статистика и комментарии">
          <div class="engagement-stats">
            <span class="stat"><strong id="viewsCount">0</strong> ПРОСМОТРОВ</span>
            <button class="vote-button" data-vote="like" type="button">${ICONS.like} НРАВИТСЯ <strong id="likesCount">0</strong></button>
            <button class="vote-button" data-vote="dislike" type="button">${ICONS.dislike} НЕ НРАВИТСЯ <strong id="dislikesCount">0</strong></button>
          </div>
          <div id="engagementStatus" class="engagement-status"></div>
          <div class="comments">
            <h2>КОММЕНТАРИИ</h2>
            <form id="commentForm" class="comment-form">
              <input id="commentName" maxlength="40" placeholder="ИМЯ" required />
              <div class="comment-form-text-wrap" id="commentTextWrap">
                <textarea id="commentText" maxlength="1000" rows="3" placeholder="" required></textarea>
                <span class="textarea-placeholder">ВАШ КОММЕНТАРИЙ</span>
              </div>
              <button class="btn" type="submit">${ICONS.send} ОТПРАВИТЬ</button>
            </form>
            <div id="commentsList" class="comments-list"><div class="comments-empty">ЗАГРУЗКА КОММЕНТАРИЕВ...</div></div>
          </div>
        </section>
      </div>
      ${rightHtml}
    </div>`;

  const video = document.getElementById("v");
  const fill = document.getElementById("progressFill");
  const dot = document.getElementById("progressDot");
  const wrap = document.getElementById("progressWrap");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const currentTime = document.getElementById("currentTime");
  const duration = document.getElementById("duration");
  const volumeControl = document.getElementById("volumeControl");
  const volumeLevel = document.getElementById("volumeLevel");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const playerPreview = document.getElementById("playerPreview");
  const playerStartBtn = document.getElementById("playerStartBtn");

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${remainingSeconds}`;
  };

  const updatePlayButton = () => {
    const isPlaying = !video.paused && !video.ended;
    playPauseBtn.innerHTML = isPlaying ? ICONS.pause : ICONS.play;
    playPauseBtn.setAttribute(
      "aria-label",
      isPlaying ? "Пауза" : "Воспроизвести",
    );
    playPauseBtn.title = isPlaying ? "Пауза" : "Воспроизвести";
  };

  if (video) {
    const clampVolume = (value) =>
      Math.min(1, Math.max(0, Math.round(Number(value) * 100) / 100));

    const readSavedVolume = () => {
      try {
        const raw =
          localStorage.getItem(PLAYER_VOLUME_STORAGE_KEY) ??
          localStorage.getItem(LEGACY_PLAYER_VOLUME_STORAGE_KEY);
        if (raw === null) return DEFAULT_VOLUME;
        const parsed = parseFloat(raw);
        return Number.isFinite(parsed) ? clampVolume(parsed) : DEFAULT_VOLUME;
      } catch (_) {
        return DEFAULT_VOLUME;
      }
    };

    const saveVolume = (value) => {
      try {
        localStorage.setItem(PLAYER_VOLUME_STORAGE_KEY, String(value));
      } catch (_) {}
    };

    let lastNonZeroVolume = DEFAULT_VOLUME;

    const updateVolume = (value, persist = true) => {
      const nextVolume = clampVolume(value);
      if (nextVolume > 0) lastNonZeroVolume = nextVolume;
      video.volume = nextVolume;
      video.muted = nextVolume === 0;
      volumeControl.value = String(nextVolume);
      volumeLevel.textContent = `VOL ${Math.round(nextVolume * 100)}%`;
      if (persist) saveVolume(nextVolume);
    };

    let userRequestedPlay = false;

    const startPlayback = () => {
      userRequestedPlay = true;
      if (video.ended) video.currentTime = 0;
      video.play().catch((error) => {
        userRequestedPlay = false;
        console.error("Video playback error:", error);
      });
    };

    video.autoplay = false;
    video.removeAttribute("autoplay");
    video.pause();
    playerPreview.classList.remove("is-hidden");
    updateVolume(readSavedVolume(), false);
    updatePlayButton();

    playPauseBtn.addEventListener("click", () => {
      if (video.paused) startPlayback();
      else video.pause();
    });

    volumeControl.addEventListener("input", () => {
      updateVolume(Number(volumeControl.value));
    });

    fullscreenBtn.addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.querySelector(".player-glass").requestFullscreen();
    });

    video.addEventListener("timeupdate", () => {
      if (!video.duration) return;
      const pct = (video.currentTime / video.duration) * 100;
      fill.style.width = pct + "%";
      dot.style.left = pct + "%";
      currentTime.textContent = formatTime(video.currentTime);
    });

    video.addEventListener("loadedmetadata", () => {
      duration.textContent = formatTime(video.duration);
    });
    video.addEventListener("pause", updatePlayButton);
    video.addEventListener("play", () => {
      if (!userRequestedPlay) {
        video.pause();
        return;
      }
      updatePlayButton();
      playerPreview.classList.add("is-hidden");
    });

    const isPreviewActive = () =>
      !playerPreview.classList.contains("is-hidden");

    const videoWrapper = video.closest(".player-video-wrapper");
    const controlsBar = videoWrapper.querySelector(".video-controls");
    const syncPreviewBounds = () => {
      if (getComputedStyle(controlsBar).display === "none") {
        playerPreview.style.bottom = "0px";
        return;
      }
      const wrapperBottom = videoWrapper.getBoundingClientRect().bottom;
      const barTop = Math.min(
        controlsBar.getBoundingClientRect().top,
        wrap.getBoundingClientRect().top,
      );
      playerPreview.style.bottom = `${Math.max(0, wrapperBottom - barTop)}px`;
    };
    const scheduleSync = () => requestAnimationFrame(syncPreviewBounds);
    syncPreviewBounds();
    new ResizeObserver(scheduleSync).observe(videoWrapper);
    new ResizeObserver(scheduleSync).observe(controlsBar);
    document.addEventListener("fullscreenchange", scheduleSync);

    videoWrapper.addEventListener("click", (event) => {
      if (event.target.closest(".video-controls, .progress-bar-wrap")) return;
      if (isPreviewActive() || video.paused) startPlayback();
      else video.pause();
    });

    window.addEventListener("pageshow", (event) => {
      if (!event.persisted) return;
      userRequestedPlay = false;
      video.pause();
      playerPreview.classList.remove("is-hidden");
      updatePlayButton();
    });
    video.addEventListener("ended", () => {
      updatePlayButton();
      playerPreview.classList.remove("is-hidden");
    });

    const seekFromPointer = (event) => {
      if (isPreviewActive()) return;
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const rect = wrap.getBoundingClientRect();
      if (!rect.width) return;
      const pct = Math.min(
        1,
        Math.max(0, (event.clientX - rect.left) / rect.width),
      );
      video.currentTime = pct * video.duration;
    };

    wrap.addEventListener("click", seekFromPointer);

    let scrubbingPointerId = null;
    wrap.addEventListener("pointerdown", (event) => {
      if (
        !event.isPrimary ||
        (event.pointerType === "mouse" && event.button !== 0)
      )
        return;
      if (isPreviewActive()) return;
      event.preventDefault();
      scrubbingPointerId = event.pointerId;
      wrap.classList.add("is-scrubbing");
      wrap.setPointerCapture(event.pointerId);
      seekFromPointer(event);
    });

    wrap.addEventListener("pointermove", (event) => {
      if (event.pointerId === scrubbingPointerId) seekFromPointer(event);
    });

    const stopScrubbing = (event) => {
      if (event.pointerId !== scrubbingPointerId) return;
      scrubbingPointerId = null;
      wrap.classList.remove("is-scrubbing");
    };

    wrap.addEventListener("pointerup", stopScrubbing);
    wrap.addEventListener("pointercancel", stopScrubbing);
    wrap.addEventListener("lostpointercapture", stopScrubbing);

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      )
        return;

      if (event.code === "Space" || event.code === "KeyK") {
        event.preventDefault();
        if (video.paused) startPlayback();
        else video.pause();
      } else if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
        event.preventDefault();
        if (isPreviewActive() || !Number.isFinite(video.duration)) return;
        const change = event.code === "ArrowLeft" ? -5 : 5;
        video.currentTime = Math.min(
          video.duration,
          Math.max(0, video.currentTime + change),
        );
      } else if (event.code === "ArrowUp" || event.code === "ArrowDown") {
        event.preventDefault();
        const currentVolume = video.muted ? 0 : video.volume;
        const change = event.code === "ArrowUp" ? 0.1 : -0.1;
        updateVolume(currentVolume + change);
      } else if (event.code === "KeyM") {
        event.preventDefault();
        if (video.muted || video.volume === 0) {
          updateVolume(lastNonZeroVolume || DEFAULT_VOLUME);
        } else {
          updateVolume(0);
        }
      } else if (event.code === "KeyF") {
        event.preventDefault();
        if (document.fullscreenElement) document.exitFullscreen();
        else
          document
            .querySelector(".player-glass")
            .requestFullscreen()
            .catch(() => {});
      }
    });
  }

  document.getElementById("copyLinkBtn").onclick = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => alert("Ссылка скопирована"));
  };
  document.getElementById("copyEmbedBtn").onclick = () => {
    navigator.clipboard
      .writeText(embedCode)
      .then(() => alert("Код embed скопирован"));
  };

  const textInputInit = document.getElementById("commentText");
  const textWrapInit = document.getElementById("commentTextWrap");
  if (textInputInit && textWrapInit) {
    const sync = () =>
      textWrapInit.classList.toggle(
        "has-value",
        Boolean(textInputInit.value.trim()),
      );
    textInputInit.addEventListener("input", sync);
    sync();
  }

  if (shortId) {
    initFirebase().then((enabled) => {
      if (enabled) setupEngagement(shortId);
      else setEngagementMessage("FIREBASE ЕЩЁ НЕ НАСТРОЕН");
    });
  }
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const v = params.get("v");

  if (v) {
    if (v.startsWith("http")) {
      const title = params.get("t") || params.get("n") || "Video";
      renderPlayer(v, title, null, null, null, null, null, null);
    } else {
      app.innerHTML = `<div class="state-msg">ЗАГРУЗКА...</div>`;
      try {
        const entries = await getAllVideoEntries();
        const idx = entries.findIndex((e) => e.id === v);
        if (idx >= 0) {
          const entry = entries[idx];
          const prevEntry = idx > 0 ? entries[idx - 1] : null;
          const nextEntry = idx < entries.length - 1 ? entries[idx + 1] : null;
          const videoUrl = buildVideoUrl(entry.tag, entry.file);
          renderPlayer(
            videoUrl,
            entry.title,
            entry.date,
            v,
            prevEntry,
            nextEntry,
            entry.description,
            entry.thumbUrl,
          );
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
