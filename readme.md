<div align="center">

# 🎬 Hinata Player

**Минималистичный видеоплеер на GitHub Releases**  
Загружай видео как релизы — смотри как на нормальном сайте.

![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-deployed-15ff00?style=flat-square&logo=github)
![License](https://img.shields.io/badge/license-MIT-white?style=flat-square)

[▶ Открыть плеер](https://xqr4d.github.io/Hinata/) · [📺 Канал](https://t.me/bipbupyoutube)

</div>

---

## Что это

Hinata — это видеохостинг без сервера. Видеофайлы хранятся прямо в GitHub Releases, а сайт на GitHub Pages их отображает в виде галереи с плеером.

Никаких баз данных, никаких платных хостингов — только GitHub.

---

## Как это работает

```
GitHub Releases  →  GitHub API  →  Hinata Player  →  Зритель
  (mp4, обложка)     (список видео)   (галерея + плеер)
```

1. Создаёшь релиз в репозитории
2. Прикладываешь к нему `.mp4` файл и `maxresdefault.jpg` как обложку
3. Видео автоматически появляется в галерее на сайте

---

## Структура релиза

Каждый релиз = одно видео. Чтобы всё работало правильно:

| Файл | Описание |
|------|----------|
| `video.mp4` | Видеофайл (mp4, mov или webm) |
| `maxresdefault.jpg` | Обложка — отображается в галерее |

Название релиза становится заголовком видео.

---

## Возможности

- **Галерея** — все видео с обложками на главной странице
- **Плеер** — встроенный видеоплеер с автовоспроизведением
- **Короткие ссылки** — вместо длинных URL вида `?v=https://github.com/...` генерируется короткий ID: `?v=o2X8Cqe0`
- **Embed** — кнопка `</> EMBED` копирует iframe-код для вставки на другой сайт
- **Скачивание** — прямая ссылка на оригинальный файл

---

## Файлы проекта

```
Hinata/
├── index.html      # Главная страница (галерея + плеер)
├── embed.html      # Встраиваемый плеер для iframe
├── script.js       # Вся логика: API, галерея, плеер, короткие ID
├── style.css       # Стили
└── icon.svg        # Иконка сайта
```

---

## Короткие ссылки

ID видео генерируется автоматически через SHA-256 хэш от тега релиза и имени файла. Это значит:

- Ссылка **одинакова на всех устройствах и браузерах**
- Ничего не хранится на сервере
- `?v=o2X8Cqe0` вместо `?v=https%3A%2F%2Fgithub.com%2F...`

---

## Embed

Нажми кнопку `</> EMBED` в плеере — получишь готовый iframe:

```html
<iframe 
  src="https://xqr4d.github.io/Hinata/embed.html?v=o2X8Cqe0" 
  width="800" 
  height="500" 
  frameborder="0" 
  allowfullscreen
></iframe>
```

---

## Использовать для своего канала

1. Сделай форк репозитория
2. В `script.js` замени:
```js
const GITHUB_USER = 'xqr4d';   // → твой GitHub username
const GITHUB_REPO = 'Hinata';  // → название твоего репо
```
3. Включи GitHub Pages (Settings → Pages → Branch: main)
4. Создавай релизы с видео — они появятся на сайте автоматически

---

<div align="center">

© 2024–2026 [BIP BUP Media](https://t.me/bipbupyoutube) · Сделано с помощью [shortlink](https://xqr4d.github.io/shortlink/)

</div>