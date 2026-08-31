const $ = id => document.getElementById(id);
let accessToken = null;
let stopRequested = false;
let tokenClient = null;

const API = "https://www.googleapis.com/youtube/v3";

const badWords = [
  "reaction",
  "live",
  "session",
  "footage",
  "review",
  "interview",
  "podcast",
  "trailer",
  "teaser",
  "behind the scenes",
  "making of",
  "tutorial",
  "cover by",
  "karaoke",
  "shorts",
  "short",
  "shorts",
  "full album",
  "fullalbum",
  "album stream",
  "full record",
  "full ep",
  "full lp",
  "complete album",
  "entire album",
  "discography",
  "compilation"
];

function log(x) {
  $("log").textContent += `\n${new Date().toLocaleTimeString()}  ${x}`;
  $("log").scrollTop = $("log").scrollHeight;
}

function esc(x) {
  return String(x ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function normalize(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\b(official|music|video|audio|lyrics?|visuali[sz]er|remix|remaster(?:ed)?|version|edit|live|hd|4k)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function artistInTitle(title, artist) {
  return normalize(title).includes(normalize(artist));
}

function songKey(title, artist) {
  let t = normalize(title);
  const a = normalize(artist);
  const escapedArtist = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  t = t.replace(new RegExp(`^${escapedArtist}\\s*`), "").trim();
  return `${a}|${t}`;
}

function durationToSeconds(duration) {
  const match = String(duration || "").match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function isVerticalVideo(video) {
  const thumbnails = Object.values(video.snippet?.thumbnails || {});
  const largestKnownThumbnail = thumbnails
    .filter(thumbnail => Number(thumbnail?.width) > 0 && Number(thumbnail?.height) > 0)
    .sort((a, b) => (Number(b.width) * Number(b.height)) - (Number(a.width) * Number(a.height)))[0];

  if (!largestKnownThumbnail) return false;
  return Number(largestKnownThumbnail.height) > Number(largestKnownThumbnail.width);
}

function config() {
  return {
    clientId: $("clientId").value.trim(),
    apiKey: $("apiKey").value.trim()
  };
}

function save() {
  localStorage.setItem("yt_config", JSON.stringify(config()));
  setupClient();
  log("Configuratie opgeslagen.");
}

function setupClient() {
  const { clientId } = config();
  if (!clientId || !window.google?.accounts?.oauth2) return;

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: "https://www.googleapis.com/auth/youtube",
    callback: response => {
      if (response.error) {
        log(`Loginfout: ${response.error}`);
        return;
      }
      accessToken = response.access_token;
      $("authStatus").textContent = "Verbonden met YouTube.";
    }
  });
}

function login() {
  setupClient();
  if (!tokenClient) {
    log("Vul eerst een geldige OAuth Client ID in.");
    return;
  }
  tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent" });
}

async function api(path, { method = "GET", body = null, auth = false } = {}) {
  const { apiKey } = config();
  const separator = path.includes("?") ? "&" : "?";
  const url = API + path + (!auth && apiKey ? `${separator}key=${encodeURIComponent(apiKey)}` : "");
  const headers = { Accept: "application/json" };

  if (auth) {
    if (!accessToken) throw new Error("Verbind eerst met YouTube.");
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (body) headers["Content-Type"] = "application/json";

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `YouTube-fout ${response.status}`);
  return data;
}

async function candidatesFor(artist, max, excludeLive) {
const query = `${artist}`;

  const searchData = await api(`/search?${new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    order: "viewCount",
    maxResults: String(max),
    videoCategoryId: "10"
  })}`);

  const ids = (searchData.items || []).map(item => item.id.videoId).filter(Boolean);
  if (!ids.length) return [];

  const videoData = await api(`/videos?${new URLSearchParams({
    part: "snippet,statistics,status,contentDetails",
    id: ids.join(",")
  })}`);

  return (videoData.items || [])
    .filter(video => {
      const title = String(video.snippet?.title || "").toLowerCase();
      const description = String(video.snippet?.description || "").toLowerCase();
      const combinedText = `${title} ${description}`;
      const durationSeconds = durationToSeconds(video.contentDetails?.duration);

      if (video.status?.embeddable === false) return false;
const channelTitle =
  String(video.snippet?.channelTitle || "").toLowerCase();

const artistName =
  normalize(artist);

const artistMentioned =
  artistInTitle(video.snippet?.title || "", artist);

const channelMatches =
  normalize(channelTitle).includes(artistName);

if (!artistMentioned && !channelMatches)
    return false;
      if (badWords.some(word => combinedText.includes(word))) return false;
      if (excludeLive && (title.includes(" live") || title.includes("live ") || title.includes("[live]"))) return false;

      // Alle video's korter dan 120 seconden uitsluiten.
      if (durationSeconds !== null && durationSeconds < 120) return false;

      // Verticale video's uitsluiten wanneer YouTube verticale thumbnailafmetingen teruggeeft.
      if (isVerticalVideo(video)) return false;

      // Lange albumuploads uitsluiten, ook als "full album" niet letterlijk in de titel staat.
      if (durationSeconds !== null && durationSeconds >= 20 * 60) return false;

      return true;
    })
    .sort((a, b) => Number(b.statistics?.viewCount || 0) - Number(a.statistics?.viewCount || 0));
}

async function createPlaylist() {
  stopRequested = false;
  $("results").innerHTML = "";
  $("playlistLink").innerHTML = "";
  $("log").textContent = "Start...";

  const artists = $("artists").value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (!artists.length) return log("Geen artiesten ingevuld.");
  if (!config().apiKey) return log("Vul eerst een API key in.");
  if (!accessToken) return log("Verbind eerst met YouTube.");

  const count = Math.max(1, Math.min(10, Number($("count").value) || 3));
  const max = Math.max(10, Math.min(50, Number($("candidates").value) || 25));
  const selected = [];
  const usedVideoIds = new Set();
  const usedSongs = new Set();

  $("create").disabled = true;

  try {
    for (let i = 0; i < artists.length; i++) {
      if (stopRequested) throw new Error("Gestopt door gebruiker.");

      const artist = artists[i];
      log(`Zoeken: ${artist}`);
      const list = await candidatesFor(artist, max, $("excludeLive").checked);
      let addedForArtist = 0;

      for (const video of list) {
        const key = songKey(video.snippet.title, artist);
        if (!key.split("|")[1]) continue;
        if (usedVideoIds.has(video.id) || usedSongs.has(key)) continue;

        usedVideoIds.add(video.id);
        usedSongs.add(key);
        selected.push({ artist, video });
        addedForArtist++;

        const row = document.createElement("tr");
        row.innerHTML = `<td>${esc(artist)}</td><td><a target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${esc(video.id)}">${esc(video.snippet.title)}</a></td><td>${esc(video.snippet.channelTitle)}</td><td>${Number(video.statistics?.viewCount || 0).toLocaleString("nl-BE")}</td>`;
        $("results").appendChild(row);

        if (addedForArtist >= count) break;
      }

      log(`${artist}: ${addedForArtist}/${count} video's geselecteerd.`);
      $("progress").value = Math.round((i + 1) / artists.length * 75);
    }

    if (!selected.length) throw new Error("Geen geschikte video's gevonden.");

    const playlist = await api("/playlists?part=snippet,status", {
      method: "POST",
      auth: true,
      body: {
        snippet: {
          title: $("playlistName").value.trim() || "Artiestenplaylist",
          description: "Automatisch samengesteld op basis van populaire YouTube-muziekvideo's."
        },
        status: { privacyStatus: $("privacy").value }
      }
    });

    for (let i = 0; i < selected.length; i++) {
      if (stopRequested) throw new Error("Gestopt tijdens toevoegen.");

      await api("/playlistItems?part=snippet", {
        method: "POST",
        auth: true,
        body: {
          snippet: {
            playlistId: playlist.id,
            resourceId: {
              kind: "youtube#video",
              videoId: selected[i].video.id
            }
          }
        }
      });

      $("progress").value = 75 + Math.round((i + 1) / selected.length * 25);
    }

    $("playlistLink").innerHTML = `Klaar: <a target="_blank" rel="noopener" href="https://www.youtube.com/playlist?list=${esc(playlist.id)}">open de playlist</a>`;
    log(`${selected.length} video's toegevoegd.`);
  } catch (error) {
    log(`Gestopt: ${error.message}`);
  } finally {
    $("create").disabled = false;
  }
}

window.addEventListener("load", () => {
  const saved = JSON.parse(localStorage.getItem("yt_config") || "{}");
  $("clientId").value = saved.clientId || "";
  $("apiKey").value = saved.apiKey || "";
  $("origin").textContent = location.origin;
  setupClient();
});

$("saveConfig").onclick = save;
$("login").onclick = login;
$("logout").onclick = () => {
  if (accessToken && window.google) google.accounts.oauth2.revoke(accessToken);
  accessToken = null;
  $("authStatus").textContent = "Niet verbonden.";
};
$("create").onclick = createPlaylist;
$("stop").onclick = () => {
  stopRequested = true;
  log("Stop aangevraagd...");
};
