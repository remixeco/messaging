import { DOMAINS, initialState, characterCount, publish, restoreState, visiblePosts, toggleMark, followDomain } from './model.mjs';
const $ = id => document.getElementById(id);
const storageKey = 'messaging-demo-v1';
const profiles = {
  'cafe.example': { theme: 'cafe', icon: 'cup', short: 'Le café de Léa', topic: 'Vie de quartier', bio: 'Du café, des concerts et les petites nouvelles du coin. Une bonne raison de se retrouver.' },
  'studio.example': { theme: 'studio', icon: 'spark', short: 'Studio Nova', topic: 'Création & idées', bio: 'Un studio indépendant. Des affiches, des idées et un regard un peu différent sur le quotidien.' },
  'collectif.example': { theme: 'collectif', icon: 'leaf', short: 'Le collectif', topic: 'Faire ensemble', bio: 'Réparer, apprendre, partager. Des rendez-vous simples pour faire vivre le quartier.' }
};
let state = initialState(), view = 'home', activeDomain = 'cafe.example', query = '', newestId = null, selectedPost = null, storageAvailable = true;
try { state = restoreState(localStorage.getItem(storageKey)) || state; } catch { storageAvailable = false; $('storage-note').textContent = 'Stockage indisponible : vos essais seront perdus au rechargement.'; }
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); storageAvailable = true; $('storage-note').textContent = 'Vos essais sont conservés dans ce navigateur. Les enregistrements suivent les dix messages encore disponibles.'; }
  catch { storageAvailable = false; $('storage-note').textContent = 'Stockage indisponible : vos essais seront perdus au rechargement.'; status('Votre essai fonctionne.', true); }
}
function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function icon(name) { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('icon'); svg.setAttribute('aria-hidden', 'true'); const use = document.createElementNS(svg.namespaceURI, 'use'); use.setAttribute('href', `#i-${name}`); svg.append(use); return svg; }
function avatar(domain) { const node = element('span', `avatar ${profiles[domain.id].theme}`, domain.letter); node.setAttribute('aria-hidden', 'true'); return node; }
function button(className, action, label, extra = {}) { const node = element('button', className, label); node.type = 'button'; node.dataset.action = action; Object.assign(node.dataset, extra); return node; }
function author(domain) { const node = button('author-button', 'profile', '', { domain: domain.id }); const labels = element('span'); labels.append(element('strong', 'author-name', domain.name), element('span', 'author-domain', domain.id)); node.append(avatar(domain), labels); node.setAttribute('aria-label', `Voir le profil de ${domain.name}`); return node; }
function followButton(domain) { const following = state.following.includes(domain.id); const node = button('follow-button', 'follow', following ? 'Abonné' : 'Suivre', { domain: domain.id }); node.setAttribute('aria-pressed', String(following)); node.setAttribute('aria-label', `${following ? 'Ne plus suivre' : 'Suivre'} ${domain.name}`); return node; }
function status(text, error = false) { $('demo-status').hidden = false; $('demo-status').textContent = text + (storageAvailable ? '' : ' Stockage indisponible : vos essais seront perdus au rechargement.'); $('demo-status').classList.toggle('error', error || !storageAvailable); }
function timeLabel(time) { const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000)); return minutes < 1 ? 'à l’instant' : minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${Math.floor(minutes / 60)} h` : new Date(time).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }
function setView(next, domain = activeDomain) { view = next; activeDomain = domain; query = ''; document.querySelectorAll('input[type=search]').forEach(input => { input.value = ''; }); render(); $('view-title').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
function renderFeed() {
  const posts = visiblePosts(state, view, activeDomain, query);
  $('feed').replaceChildren(); $('feed-count').textContent = `${posts.length} message${posts.length > 1 ? 's' : ''}`;
  $('feed-label').textContent = query ? `Résultats pour « ${query} »` : view === 'saved' ? 'Vos repères locaux' : 'Les plus récents';
  if (!posts.length) { const empty = element('div', 'empty-state'); empty.append(element('strong', '', query ? 'Aucun message trouvé.' : view === 'saved' ? 'Gardez ce qui vous parle.' : 'Votre fil attend ses premières sources.'), element('p', '', query ? 'Essayez un autre mot ou un autre fil.' : view === 'saved' ? 'Appuyez sur le marque-page d’un message. Il restera ici tant qu’il est disponible à la source.' : 'Explorez les domaines et appuyez sur Suivre.')); $('feed').append(empty); }
  for (const post of posts) {
    const domain = DOMAINS.find(item => item.id === post.domain), profile = profiles[post.domain];
    const card = element('article', `post${post.domain === 'studio.example' ? ' post-quote' : ''}${post.id === newestId ? ' is-new' : ''}`);
    const header = element('div', 'post-header'), time = element('time', '', timeLabel(post.time)); time.dateTime = new Date(post.time).toISOString(); header.append(author(domain), time);
    const content = element('div', 'post-content'); const topic = button('post-topic', 'profile', `# ${profile.topic}`, { domain: post.domain });
    content.append(element('p', 'message-body', post.text), topic);
    const actions = element('div', 'post-actions');
    for (const [action, shape, label, key] of [['like', 'heart', 'J’aime', 'likes'], ['save', 'bookmark', 'Garder', 'saved'], ['copy', 'copy', 'Copier', null]]) {
      const marked = key && state[key].includes(post.id), control = button(action, action, '', { id: String(post.id) });
      control.append(icon(shape), element('span', '', marked ? action === 'like' ? 'Aimé' : 'Gardé' : label));
      control.setAttribute('aria-label', `${marked ? action === 'like' ? 'Retirer J’aime' : 'Ne plus garder' : label} · message ${post.id}`);
      if (key) control.setAttribute('aria-pressed', String(marked)); actions.append(control);
    }
    content.append(actions); card.append(header, content); $('feed').append(card);
  }
}
function renderProfile() {
  $('profile-card').hidden = view !== 'profile'; if (view !== 'profile') return;
  const domain = DOMAINS.find(item => item.id === activeDomain), profile = profiles[activeDomain];
  const cover = element('div', `profile-cover ${profile.theme}`); cover.append(icon(profile.icon));
  const info = element('div', 'profile-info'), top = element('div', 'profile-topline'); top.append(avatar(domain), followButton(domain));
  const meta = element('div', 'profile-meta'); meta.append(element('span', '', `${state.posts[domain.id].length} / 10 messages`), element('span', '', profile.topic), element('span', '', 'Domaine fictif'));
  info.append(top, element('h2', '', domain.name), element('span', 'author-domain', domain.id), element('p', '', profile.bio), meta); $('profile-card').replaceChildren(cover, info);
}
function renderSuggestions() {
  for (const id of ['suggestions', 'mobile-suggestions']) { const list = $(id); list.replaceChildren(); for (const domain of DOMAINS) { const row = element('div', 'suggestion'); row.append(author(domain), followButton(domain)); list.append(row); } }
  $('source-count').textContent = `${state.following.length + state.addedDomains.length} sources`;
  $('added-sources').replaceChildren();
  for (const domain of state.addedDomains) {
    const row = element('div', 'added-source'), label = element('div'), remove = button('secondary', 'unfollow-added', 'Retirer', { domain });
    remove.setAttribute('aria-label', `Retirer ${domain}`);
    label.append(element('strong', '', domain), element('small', '', 'Enregistré ici · non connecté'));
    row.append(label, remove); $('added-sources').append(row);
  }
}
function renderHistory() {
  const domain = view === 'profile' ? activeDomain : $('publisher').value;
  const posts = state.posts[domain]; if (!posts.some(post => post.id === selectedPost)) selectedPost = posts[0]?.id;
  $('history-title').textContent = domain; $('history-count').textContent = `${posts.length} / 10`; $('history-slots').replaceChildren();
  for (let i = 0; i < 10; i++) { const post = posts[i]; if (!post) { $('history-slots').append(element('span', 'vacant')); continue; } const node = button('', 'slot', String(i + 1), { id: String(post.id) }); node.setAttribute('aria-label', `Message ${i + 1} : ${post.text}`); node.setAttribute('aria-pressed', String(post.id === selectedPost)); $('history-slots').append(node); }
  $('slot-detail').textContent = posts.find(post => post.id === selectedPost)?.text || '';
}
function render() {
  const headings = { home: ['Accueil', 'Les nouvelles de votre petit monde.'], explore: ['Explorer', 'Trois univers. De nouvelles connexions.'], saved: ['Enregistrés', 'Vos messages gardés, tant qu’ils sont disponibles.'], profile: [DOMAINS.find(item => item.id === activeDomain).name, activeDomain] };
  $('view-title').textContent = headings[view][0]; $('view-subtitle').textContent = headings[view][1];
  document.querySelectorAll('[data-view]').forEach(node => { if (node.dataset.view === view && (view !== 'profile' || activeDomain === $('publisher').value)) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); });
  $('source-strip').hidden = view === 'saved' || view === 'profile'; $('feed-tabs').hidden = view === 'saved' || view === 'profile'; $('composer').hidden = view === 'saved' || (view === 'profile' && activeDomain !== $('publisher').value);
  const domain = DOMAINS.find(item => item.id === $('publisher').value); $('composer-avatar').className = `avatar composer-avatar ${profiles[domain.id].theme}`; $('composer-avatar').textContent = domain.letter; $('identity-name').textContent = domain.name;
  const identity = $('my-profile').querySelector('.avatar'); identity.className = `avatar ${profiles[domain.id].theme}`; identity.textContent = domain.letter;
  renderProfile(); renderSuggestions(); renderFeed(); renderHistory();
}
function validate() { const length = characterCount($('message').value), invalid = length > 150; $('character-count').textContent = `${length} / 150`; $('character-count').classList.toggle('over', invalid); $('message-error').textContent = invalid ? `${length - 150} caractère${length - 150 > 1 ? 's' : ''} à retirer.` : ''; $('message').setAttribute('aria-invalid', String(invalid)); $('publish-button').disabled = !$('message').value.trim() || invalid; }
function send(domain, text) {
  try { const { message, removed } = publish(state, domain, text); newestId = message.id; selectedPost = message.id; view = 'profile'; activeDomain = domain; query = ''; document.querySelectorAll('input[type=search]').forEach(input => { input.value = ''; }); save(); render(); status(removed ? `Publié. Dix messages, toujours : le plus ancien a laissé sa place — « ${removed.text} »` : `Publié dans la démo de ${domain}. ${state.posts[domain].length} messages sur dix.`); return true; }
  catch (error) { status(error.message, true); return false; }
}
$('compose-form').addEventListener('submit', event => { event.preventDefault(); if (send($('publisher').value, $('message').value)) { $('message').value = ''; validate(); } });
$('message').addEventListener('input', validate);
$('publisher').addEventListener('change', () => { selectedPost = null; if (view === 'profile') activeDomain = $('publisher').value; render(); });
$('use-example').addEventListener('click', () => { $('message').value = DOMAINS.find(item => item.id === $('publisher').value).example; validate(); $('message').focus(); });
for (const input of document.querySelectorAll('input[type=search]')) input.addEventListener('input', () => { query = input.value; document.querySelectorAll('input[type=search]').forEach(other => { if (other !== input) other.value = query; }); renderFeed(); });
for (const node of document.querySelectorAll('[data-view]')) node.addEventListener('click', () => setView(node.dataset.view, node.dataset.view === 'profile' ? $('publisher').value : activeDomain));
for (const node of document.querySelectorAll('.compose-trigger')) node.addEventListener('click', () => { if ($('composer').hidden) { view = 'home'; render(); } $('message').focus(); $('composer').scrollIntoView({ block: 'center', behavior: 'instant' }); });
$('my-profile').addEventListener('click', () => setView('profile', $('publisher').value));
function rotate() { $('publisher').value = 'cafe.example'; send('cafe.example', `Le concert commence à 19 h. Nouvelle annonce nº ${state.nextId} : on vous garde une place ?`); $('demo-status').scrollIntoView({ block: 'center', behavior: 'instant' }); }
$('test-rotation').addEventListener('click', rotate); $('mobile-rotation').addEventListener('click', rotate);
for (const node of document.querySelectorAll('.reset-trigger')) node.addEventListener('click', () => { $('reset-confirmation').hidden = false; $('cancel-reset').focus(); });
$('cancel-reset').addEventListener('click', () => { $('reset-confirmation').hidden = true; $('view-title').focus(); });
$('confirm-reset').addEventListener('click', () => {
  try { localStorage.removeItem(storageKey); }
  catch { status('L’effacement du stockage a échoué. Utilisez les réglages de votre navigateur pour supprimer les données de ce site.', true); $('demo-status').scrollIntoView({ block: 'center' }); return; }
  state = initialState(); newestId = null; selectedPost = null; storageAvailable = true;
  $('publisher').value = 'cafe.example'; $('message').value = ''; $('domain-input').value = ''; $('domain-feedback').textContent = ''; $('domain-input').removeAttribute('aria-invalid'); $('reset-confirmation').hidden = true;
  $('storage-note').textContent = 'Les essais sauvegardés ont été effacés. Une prochaine interaction sera à nouveau sauvegardée.';
  setView('home', 'cafe.example'); validate(); status('Vos essais sauvegardés ont été effacés de ce navigateur. Les exemples fictifs sont à nouveau affichés.');
});
$('domain-example').addEventListener('click', () => { $('domain-input').value = 'collectif.example'; $('domain-input').focus(); });
$('domain-input').addEventListener('input', () => { $('domain-input').removeAttribute('aria-invalid'); $('domain-feedback').textContent = ''; });
$('follow-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const { domain, demo, added } = followDomain(state, $('domain-input').value);
    if (added) save(); render();
    $('domain-input').removeAttribute('aria-invalid'); $('domain-feedback').classList.remove('input-error');
    $('domain-feedback').textContent = `${domain} ${added ? 'a été ajouté' : 'est déjà dans vos sources'}. ${demo ? 'Ses messages fictifs sont disponibles dans Abonnements.' : 'Adresse conservée ici : aucun message récupéré, aucune identité vérifiée.'}${storageAvailable ? '' : ' Attention : la sauvegarde est indisponible.'}`;
    $('domain-input').value = '';
  } catch (error) { $('domain-feedback').textContent = error.message; $('domain-feedback').classList.add('input-error'); $('domain-input').setAttribute('aria-invalid', 'true'); $('domain-input').focus(); }
});
$('export-data').addEventListener('click', () => {
  let url;
  try {
    url = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), prototype: 'Messaging — essais locaux', data: state }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'messaging-mes-essais.json'; document.body.append(link); link.click(); link.remove();
    status('Export demandé au navigateur. Le fichier contient vos essais : gardez-le dans un endroit approprié.');
  } catch { status('L’export n’a pas pu démarrer. Réessayez dans un navigateur autorisant les téléchargements.', true); }
  finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); }
});
window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return;
  state = restoreState(event.newValue) || initialState(); newestId = null; selectedPost = null; $('message').value = ''; $('domain-input').value = ''; $('domain-feedback').textContent = ''; render(); validate();
  status(event.newValue ? 'Vos essais ont été actualisés depuis un autre onglet.' : 'Les essais sauvegardés ont été effacés dans un autre onglet.');
});
document.addEventListener('click', async event => {
  const control = event.target.closest('button[data-action]'); if (!control) return;
  const { action, domain } = control.dataset, id = Number(control.dataset.id);
  if (action === 'profile') setView('profile', domain);
  if (action === 'unfollow-added') { state.addedDomains = state.addedDomains.filter(item => item !== domain); save(); renderSuggestions(); $('domain-feedback').classList.remove('input-error'); $('domain-feedback').textContent = `${domain} a été retiré de votre liste locale.`; $('domain-input').focus(); }
  if (action === 'follow') { const parentId = control.closest('[id]')?.id; state.following = state.following.includes(domain) ? state.following.filter(value => value !== domain) : [...state.following, domain]; save(); render(); const label = DOMAINS.find(item => item.id === domain).name; status(`${label} ${state.following.includes(domain) ? 'rejoint votre fil' : 'a quitté vos abonnements'}.`); $(parentId)?.querySelector(`[data-action="follow"][data-domain="${domain}"]`)?.focus({ preventScroll: true }); }
  if (action === 'like' || action === 'save') { const marked = toggleMark(state, action === 'like' ? 'likes' : 'saved', id); save(); renderFeed(); const target = $('feed').querySelector(`[data-action="${action}"][data-id="${id}"]`); if (target) target.focus({ preventScroll: true }); else $('view-title').focus({ preventScroll: true }); if (action === 'save') status(marked ? 'Message gardé dans Enregistrés, tant qu’il reste disponible à la source.' : 'Message retiré des enregistrements.'); }
  if (action === 'slot') { selectedPost = id; renderHistory(); $('history-slots').querySelector(`[data-id="${id}"]`)?.focus({ preventScroll: true }); }
  if (action === 'copy') { const post = Object.values(state.posts).flat().find(item => item.id === id); if (!post) return; try { await navigator.clipboard.writeText(post.text); status('Texte copié. Vous pouvez le partager ailleurs.'); } catch { status('La copie est indisponible ici. Vous pouvez sélectionner et copier le texte du message.', true); } }
});
const intro = element('div', 'source-button source-intro'); intro.append(element('strong', '', 'Les voix du moment'), element('small', '', 'Un domaine, un univers.')); $('source-strip').append(intro);
for (const domain of DOMAINS) { const profile = profiles[domain.id], source = button('source-button', 'profile', '', { domain: domain.id }), ring = element('span', 'story-ring'), image = avatar(domain); image.replaceChildren(icon(profile.icon)); ring.append(image); source.append(ring, element('span', '', profile.short)); source.setAttribute('aria-label', `Découvrir ${domain.name}`); $('source-strip').append(source); const community = button('community-link', 'profile', '', { domain: domain.id }); community.append(icon('hash'), element('span', '', profile.topic)); $('community-links').append(community); }
// shortcut: profils et interactions limités à ce navigateur ; connecter le protocole dans un futur prototype technique.
render(); validate();
function revealPanel() {
  const id = location.hash.slice(1);
  if (!['follow-panel', 'mes-donnees'].includes(id)) return;
  $(id).open = true; $(id).scrollIntoView({ block: 'start', behavior: 'instant' });
}
window.addEventListener('hashchange', revealPanel); revealPanel();
if (!storageAvailable) status('La démo fonctionne sans sauvegarde.', true);
