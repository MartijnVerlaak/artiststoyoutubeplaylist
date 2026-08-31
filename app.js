const $=id=>document.getElementById(id);let accessToken=null,stopRequested=false,tokenClient=null;
const API="https://www.googleapis.com/youtube/v3";
const badWords=[
  "reaction",
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
  "full album",
  "album stream",
  "full record",
  "full ep",
  "discography",
  "playlist",
  "mix",
  "compilation"
];
function log(x){$("log").textContent+=`\n${new Date().toLocaleTimeString()}  ${x}`;$("log").scrollTop=$("log").scrollHeight}
function esc(x){return String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function normalize(s){return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\([^)]*\)|\[[^\]]*\]/g," ").replace(/\b(official|music|video|audio|lyrics?|visuali[sz]er|remix|remaster(?:ed)?|version|edit|live|hd|4k)\b/g," ").replace(/[^a-z0-9]+/g," ").trim()}
function artistInTitle(title,artist){return normalize(title).includes(normalize(artist))}
function songKey(title,artist){let t=normalize(title),a=normalize(artist);t=t.replace(new RegExp(`^${a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*`),"").trim();return `${a}|${t}`}
function config(){return{clientId:$("clientId").value.trim(),apiKey:$("apiKey").value.trim()}}
function save(){localStorage.setItem("yt_config",JSON.stringify(config()));setupClient();log("Configuratie opgeslagen.")}
function setupClient(){const{clientId}=config();if(!clientId||!window.google?.accounts?.oauth2)return;tokenClient=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:"https://www.googleapis.com/auth/youtube",callback:r=>{if(r.error)return log(`Loginfout: ${r.error}`);accessToken=r.access_token;$("authStatus").textContent="Verbonden met YouTube."}})}
function login(){setupClient();if(!tokenClient)return log("Vul eerst een geldige OAuth Client ID in.");tokenClient.requestAccessToken({prompt:accessToken?"":"consent"})}
async function api(path,{method="GET",body=null,auth=false}={}){const{apiKey}=config();const sep=path.includes("?")?"&":"?";const url=API+path+(!auth&&apiKey?`${sep}key=${encodeURIComponent(apiKey)}`:"");const headers={Accept:"application/json"};if(auth){if(!accessToken)throw new Error("Verbind eerst met YouTube.");headers.Authorization=`Bearer ${accessToken}`}if(body)headers["Content-Type"]="application/json";const r=await fetch(url,{method,headers,body:body?JSON.stringify(body):null});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error?.message||`YouTube-fout ${r.status}`);return d}
async function candidatesFor(artist,max,excludeLive){const q=`${artist} official music video`;const s=await api(`/search?${new URLSearchParams({part:"snippet",q,type:"video",order:"viewCount",maxResults:String(max),videoCategoryId:"10"})}`);const ids=(s.items||[]).map(x=>x.id.videoId).filter(Boolean);if(!ids.length)return[];const d=await api(`/videos?${
  new URLSearchParams({
    part:"snippet,statistics,status,contentDetails",
    id:ids.join(",")
  })
}`);;return (d.items || []).filter(v=>{

  const title=v.snippet.title.toLowerCase();

  const duration=v.contentDetails?.duration || "";

  // Shorts meestal < 60 seconden
  if(duration.match(/^PT([0-5]?[0-9])S$/)) {
    return false;
  }

  if(duration.match(/^PT1M$/)) {
    return false;
  }
async function createPlaylist(){stopRequested=false;$("results").innerHTML="";$("playlistLink").innerHTML="";$("log").textContent="Start...";const artists=$("artists").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!artists.length)return log("Geen artiesten ingevuld.");if(!config().apiKey)return log("Vul eerst een API key in.");if(!accessToken)return log("Verbind eerst met YouTube.");const count=Math.max(1,Math.min(10,Number($("count").value)||3)),max=Math.max(10,Math.min(50,Number($("candidates").value)||25));const selected=[],usedVideoIds=new Set(),usedSongs=new Set();$("create").disabled=true;try{for(let i=0;i<artists.length;i++){if(stopRequested)throw new Error("Gestopt door gebruiker.");const artist=artists[i];log(`Zoeken: ${artist}`);const list=await candidatesFor(artist,max,$("excludeLive").checked);let n=0;for(const v of list){const key=songKey(v.snippet.title,artist);if(usedVideoIds.has(v.id)||usedSongs.has(key))continue;usedVideoIds.add(v.id);usedSongs.add(key);selected.push({artist,video:v});n++;const tr=document.createElement("tr");tr.innerHTML=`<td>${esc(artist)}</td><td><a target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${esc(v.id)}">${esc(v.snippet.title)}</a></td><td>${esc(v.snippet.channelTitle)}</td><td>${Number(v.statistics?.viewCount||0).toLocaleString("nl-BE")}</td>`;$("results").appendChild(tr);if(n>=count)break}log(`${artist}: ${n}/${count} video's geselecteerd.`);$("progress").value=Math.round((i+1)/artists.length*75)}if(!selected.length)throw new Error("Geen geschikte video's gevonden.");const p=await api("/playlists?part=snippet,status",{method:"POST",auth:true,body:{snippet:{title:$("playlistName").value.trim()||"Artiestenplaylist",description:"Automatisch samengesteld op basis van populaire YouTube-muziekvideo’s."},status:{privacyStatus:$("privacy").value}}});for(let i=0;i<selected.length;i++){if(stopRequested)throw new Error("Gestopt tijdens toevoegen.");await api("/playlistItems?part=snippet",{method:"POST",auth:true,body:{snippet:{playlistId:p.id,resourceId:{kind:"youtube#video",videoId:selected[i].video.id}}}});$("progress").value=75+Math.round((i+1)/selected.length*25)}$("playlistLink").innerHTML=`Klaar: <a target="_blank" rel="noopener" href="https://www.youtube.com/playlist?list=${esc(p.id)}">open de playlist</a>`;log(`${selected.length} video's toegevoegd.`)}catch(e){log(`Gestopt: ${e.message}`)}finally{$("create").disabled=false}}
window.addEventListener("load",()=>{const c=JSON.parse(localStorage.getItem("yt_config")||"{}");$("clientId").value=c.clientId||"";$("apiKey").value=c.apiKey||"";$("origin").textContent=location.origin;setupClient()});$("saveConfig").onclick=save;$("login").onclick=login;$("logout").onclick=()=>{if(accessToken&&window.google)google.accounts.oauth2.revoke(accessToken);accessToken=null;$("authStatus").textContent="Niet verbonden."};$("create").onclick=createPlaylist;$("stop").onclick=()=>{stopRequested=true;log("Stop aangevraagd...")};
