# YouTube artiesten naar playlist

Statische GitHub Pages-app. De app zoekt over heel YouTube, dus ook op labelkanalen, sorteert kandidaat-video’s op views en maakt via OAuth een playlist in je eigen YouTube-account.

## Benodigd

- Google-account met een YouTube-kanaal
- Google Cloud-project
- YouTube Data API v3
- API key voor zoeken
- OAuth 2.0 Client ID van type Web application voor playlistacties

## Google Cloud instellen

1. Open Google Cloud Console en maak/selecteer een project.
2. Ga naar APIs & Services > Library.
3. Zoek YouTube Data API v3 en klik Enable.
4. Configureer Google Auth Platform / OAuth consent screen.
5. Kies External voor persoonlijk gebruik en voeg je eigen Google-account toe als test user wanneer de app in testmodus staat.
6. Voeg als scope toe: `https://www.googleapis.com/auth/youtube`.
7. Ga naar Credentials > Create credentials > API key.
8. Beperk de API key tot YouTube Data API v3. Voeg na publicatie ook een website restriction toe voor jouw GitHub Pages-adres.
9. Maak via Credentials een OAuth Client ID van type Web application.
10. Voeg bij Authorized JavaScript origins exact de origin toe die de app toont, bijvoorbeeld `https://jouwnaam.github.io`. Er is voor deze Google Identity Services token-flow geen redirect URI in de app nodig.

## GitHub Pages

1. Maak een repository, bijvoorbeeld `youtube-playlistmaker`.
2. Upload `index.html`, `styles.css` en `app.js` in de hoofdmap.
3. Ga naar Settings > Pages.
4. Kies Deploy from a branch, branch main, map /(root).
5. Open de gepubliceerde site.
6. Plak je OAuth Client ID en API key in de app en klik Opslaan.
7. Klik Verbinden met YouTube.
8. Vul artiesten in en maak de playlist.

## Selectielogica

- Zoekt `<artiest> official music video` over heel YouTube.
- Gebruikt muziekcategorie 10.
- Vraagt resultaten op in volgorde van views.
- Controleert of de artiestnaam in de titel staat.
- Sluit reacties, reviews, interviews, podcasts, trailers en vergelijkbare resultaten uit.
- Livevideo’s kunnen optioneel worden uitgesloten.
- Ontdubbelt op video-ID en genormaliseerde songtitel.

Dit is een heuristische selectie. YouTube biedt geen universeel veld dat bewijst dat een video de officiële clip van een artiest is. Controleer daarom de resultatentabel voordat je de uiteindelijke playlist gebruikt.

## Quota

`search.list` is de beperkende aanvraag. De app doet normaal één zoekaanvraag en één goedkope `videos.list`-aanvraag per artiest. Het aanmaken van de playlist en ieder toegevoegd playlistitem kosten eveneens quota. Bekijk je verbruik in Google Cloud > APIs & Services > YouTube Data API v3 > Quotas.
