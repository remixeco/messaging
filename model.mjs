export const DOMAINS = [
  { id: 'cafe.example', name: 'Le café de Léa', letter: 'L', color: '#ffae99', example: 'Concert acoustique ce soir à 19 h. Entrée libre. On vous garde une place ?' },
  { id: 'studio.example', name: 'Studio Nova', letter: 'N', color: '#e9e0ff', example: 'Notre nouvelle affiche est prête. Passez au studio samedi pour la découvrir !' },
  { id: 'collectif.example', name: 'Le collectif', letter: 'C', color: '#b5f4d9', example: 'Atelier réparation samedi à 14 h. Apportez votre objet et vos idées, on cherche ensemble.' }
];
const segmenter = new Intl.Segmenter('fr', { granularity: 'grapheme' });
export const characterCount = text => Array.from(segmenter.segment(text)).length;
const known = id => DOMAINS.some(domain => domain.id === id);

export function initialState(now = Date.now()) {
  const examples = [
    ['Concert acoustique ce soir à 19 h. Entrée libre.', 'Le gâteau du jour : citron et graines de pavot.', 'Samedi, on échange nos livres autour d’un café.', 'Le coin lecture vous attend. Prenez votre temps.', 'Une nouvelle expo sur nos murs : venez jeter un œil.', 'Demain, la terrasse ouvre dès 9 h.', 'Le mercredi, place aux jeux de société.', 'Vous nous avez demandé du chocolat chaud. Il est là !', 'Notre petit café fête son premier printemps.', 'Bienvenue au café de Léa. Ici, les bonnes nouvelles tiennent en quelques mots.'],
    ['Une nouvelle collection d’affiches se prépare.', 'Le studio ouvre ses portes samedi après-midi.', 'Aujourd’hui, on dessine la ville autrement.'],
    ['L’atelier vélo revient dimanche à 10 h.', 'Besoin d’un coup de main pour réparer ? On se retrouve samedi.', 'Une table, des idées, et l’envie de faire ensemble.']
  ];
  const posts = {}; let id = 0;
  DOMAINS.forEach((domain, group) => { posts[domain.id] = examples[group].map((text, i) => ({ id: ++id, text, time: now - (i * 3 + group + 1) * 60000 })); });
  return { version: 1, nextId: id + 1, following: ['cafe.example', 'studio.example'], addedDomains: [], posts, likes: [], saved: [] };
}

export function normalizeDomain(raw) {
  if (typeof raw !== 'string' || raw.length > 500 || /[\s@\\]/u.test(raw.trim())) throw new Error('Indiquez un domaine, par exemple cafe.example, ou son adresse https.');
  let url;
  try { url = new URL(raw.includes('://') ? raw.trim() : `https://${raw.trim()}`); } catch { throw new Error('Cette adresse ne ressemble pas à un nom de domaine.'); }
  const domain = url.hostname.replace(/\.$/, '').toLowerCase();
  const labels = domain.split('.');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || domain.length > 253 || labels.length < 2 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || !/[a-z]/.test(labels.at(-1)) || ['localhost', 'local', 'internal'].includes(labels.at(-1))) throw new Error('Utilisez un nom de domaine complet, sans identifiant ni port.');
  return domain;
}

export function followDomain(state, raw) {
  const domain = normalizeDomain(raw), demo = known(domain);
  const list = demo ? state.following : state.addedDomains;
  const added = !list.includes(domain);
  if (added) {
    if (!demo && list.length >= 100) throw new Error('Cette démo est limitée à 100 domaines ajoutés. Retirez une source pour en ajouter une autre.');
    list.push(domain);
  }
  return { domain, demo, added };
}

export function publish(state, domain, rawText, now = Date.now()) {
  if (!known(domain)) throw new Error('Choisissez un domaine de démonstration.');
  if (typeof rawText !== 'string' || !rawText.trim()) throw new Error('Écrivez quelques mots avant de publier.');
  if (rawText.length > 4000) throw new Error('Ce texte contient trop de signes combinés. Simplifiez-le avant de publier.');
  if (characterCount(rawText) > 150) throw new Error('Votre message dépasse 150 caractères.');
  const message = { id: state.nextId++, text: rawText.trim(), time: now };
  state.posts[domain].unshift(message);
  const removed = state.posts[domain].length > 10 ? state.posts[domain].pop() : null;
  if (removed) for (const key of ['likes', 'saved']) state[key] = (state[key] || []).filter(id => id !== removed.id);
  return { message, removed };
}

export function feedFor(state) {
  return state.following.flatMap(domain => state.posts[domain].map(post => ({ ...post, domain })))
    .sort((a, b) => b.time - a.time || b.id - a.id);
}

export function visiblePosts(state, view = 'home', domain = 'cafe.example', query = '') {
  const following = view === 'home' ? state.following : view === 'profile' ? [domain] : DOMAINS.map(item => item.id);
  if (following.some(id => !known(id))) return [];
  const normalize = text => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr');
  const needle = normalize(query.trim());
  return feedFor({ ...state, following }).filter(post =>
    (view !== 'saved' || state.saved.includes(post.id)) &&
    (!needle || normalize(post.text + ' ' + post.domain + ' ' + DOMAINS.find(item => item.id === post.domain).name).includes(needle)));
}

export function toggleMark(state, key, id) {
  if (!['likes', 'saved'].includes(key) || !Object.values(state.posts).some(posts => posts.some(post => post.id === id))) return false;
  const index = state[key].indexOf(id);
  if (index < 0) state[key].push(id); else state[key].splice(index, 1);
  return state[key].includes(id);
}

export function restoreState(raw) {
  if (!raw || raw.length > 1000000) return null;
  try {
    const state = JSON.parse(raw);
    if (state.version !== 1 || !Number.isSafeInteger(state.nextId) || state.nextId < 1 || !Array.isArray(state.following) || state.following.some(id => !known(id)) || new Set(state.following).size !== state.following.length || !state.posts) return null;
    if (state.addedDomains === undefined) state.addedDomains = [];
    if (!Array.isArray(state.addedDomains) || state.addedDomains.length > 100 || new Set(state.addedDomains).size !== state.addedDomains.length || state.addedDomains.some(domain => normalizeDomain(domain) !== domain || known(domain))) return null;
    const ids = new Set();
    for (const domain of DOMAINS) {
      const posts = state.posts[domain.id];
      if (!Array.isArray(posts) || posts.length > 10) return null;
      for (const post of posts) {
        if (!post || !Number.isSafeInteger(post.id) || post.id < 1 || post.id >= state.nextId || ids.has(post.id) || typeof post.text !== 'string' || !post.text.trim() || post.text.length > 4000 || characterCount(post.text) > 150 || !Number.isFinite(post.time) || post.time < 0 || post.time > 8640000000000000) return null;
        ids.add(post.id);
      }
    }
    for (const key of ['likes', 'saved']) {
      if (state[key] === undefined) state[key] = [];
      if (!Array.isArray(state[key]) || state[key].length > 30 || state[key].some(id => !Number.isSafeInteger(id)) || new Set(state[key]).size !== state[key].length) return null;
      state[key] = state[key].filter(id => ids.has(id));
    }
    return state;
  } catch { return null; }
}
