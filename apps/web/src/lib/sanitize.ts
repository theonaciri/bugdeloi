/**
 * Assainissement du HTML des articles DILA (bloc CONTENU de LEGI) par liste blanche.
 *
 * Le HTML de LEGI est simple (paragraphes, sauts de ligne, tableaux, gras/italique, exposants),
 * mais il provient d'une source externe : on ne le rend jamais tel quel (AGENTS.md §9.3).
 * Principe : on découpe en jetons, on ne garde que les balises et attributs listés, on échappe
 * tout le texte, on supprime entièrement le contenu des balises dangereuses et on rééquilibre
 * les balises ouvertes/fermées. Les liens DILA (`<a href="/affichCodeArticle.do?…">`) pointent
 * vers d'anciennes URL Légifrance relatives : on garde leur texte, pas le lien.
 *
 * Aucune dépendance : la grammaire acceptée est volontairement plus étroite que HTML.
 */

/** Balises conservées → attributs autorisés (valeurs validées par `ATTRIBUTE_RULES`). */
const ALLOWED: Record<string, readonly string[]> = {
  p: ['align'],
  br: [],
  b: [],
  strong: [],
  i: [],
  em: [],
  u: [],
  sup: [],
  sub: [],
  span: [],
  div: ['align'],
  blockquote: [],
  ul: [],
  ol: [],
  li: [],
  table: [],
  thead: [],
  tbody: [],
  tfoot: [],
  tr: [],
  th: ['colspan', 'rowspan', 'align'],
  td: ['colspan', 'rowspan', 'align'],
  caption: [],
  h1: [],
  h2: [],
  h3: [],
  h4: [],
  h5: [],
  h6: [],
  pre: [],
  hr: [],
}

/** Balises dont on retire la balise mais dont on garde le texte (ex. `<a>`, `<font>`). */
const UNWRAP = new Set(['a', 'font', 'center', 'small', 'big', 'abbr', 'cite', 'q', 'dfn', 'nobr'])

/** Balises dont tout le contenu est supprimé. */
const DROP_WITH_CONTENT = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'noscript',
  'template',
  'svg',
  'math',
  'textarea',
  'select',
  'title',
  'head',
  'frameset',
  'frame',
  'xmp',
  'plaintext',
])

const VOID = new Set(['br', 'hr'])

const ATTRIBUTE_RULES: Record<string, RegExp> = {
  align: /^(left|right|center|justify)$/i,
  colspan: /^[1-9]\d{0,2}$/,
  rowspan: /^[1-9]\d{0,2}$/,
}

/** Entités nommées acceptées telles quelles ; les autres `&` sont échappés. */
const NAMED_ENTITY =
  /^&(?:amp|lt|gt|quot|apos|nbsp|laquo|raquo|euro|deg|sect|eacute|egrave|agrave|ccedil|hellip|ndash|mdash|rsquo|lsquo|ldquo|rdquo|middot|times|frac12|frac14|frac34|ordm|ordf|sup2|sup3|thinsp|ensp|emsp|shy|copy|reg|ecirc|acirc|icirc|ocirc|ucirc|ugrave|euml|iuml|uuml|oelig|OElig|Eacute|Egrave|Agrave|Ccedil);/
const NUMERIC_ENTITY = /^&#(?:\d{1,7}|[xX][0-9a-fA-F]{1,6});/

function escapeText(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i] as string
    if (ch === '&') {
      const rest = text.slice(i, i + 12)
      const m = NAMED_ENTITY.exec(rest) ?? NUMERIC_ENTITY.exec(rest)
      if (m && isSafeNumericEntity(m[0])) {
        out += m[0]
        i += m[0].length
        continue
      }
      out += '&amp;'
    } else if (ch === '<') out += '&lt;'
    else if (ch === '>') out += '&gt;'
    else if (ch === '"') out += '&quot;'
    else out += ch
    i++
  }
  return out
}

/** Refuse les entités numériques qui désignent des caractères de contrôle ou hors Unicode. */
function isSafeNumericEntity(entity: string): boolean {
  if (!entity.startsWith('&#')) return true
  const body = entity.slice(2, -1)
  const code = body[0] === 'x' || body[0] === 'X' ? Number.parseInt(body.slice(1), 16) : Number(body)
  if (!Number.isFinite(code) || code > 0x10ffff) return false
  if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) return false
  return !(code >= 0x7f && code <= 0x9f)
}

/** Décode les quelques entités utiles pour valider une valeur d'attribut. */
function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

const TAG_RE = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/
const ATTR_RE = /([^\s=/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

function parseAttributes(raw: string): Array<[string, string]> {
  const attrs: Array<[string, string]> = []
  ATTR_RE.lastIndex = 0
  for (let m = ATTR_RE.exec(raw); m !== null; m = ATTR_RE.exec(raw)) {
    const name = (m[1] ?? '').toLowerCase()
    if (!name) continue
    attrs.push([name, decodeAttr(m[2] ?? m[3] ?? m[4] ?? '')])
  }
  return attrs
}

function renderOpenTag(tag: string, rawAttrs: string): string {
  const allowed = ALLOWED[tag] ?? []
  let out = `<${tag}`
  const seen = new Set<string>()
  for (const [name, value] of parseAttributes(rawAttrs)) {
    if (!allowed.includes(name) || seen.has(name)) continue
    const rule = ATTRIBUTE_RULES[name]
    if (!rule?.test(value)) continue
    seen.add(name)
    out += ` ${name}="${value.toLowerCase()}"`
  }
  return `${out}>`
}

/**
 * Renvoie un fragment HTML sûr à insérer avec `{@html}`. Idempotent : `sanitize(sanitize(x)) === sanitize(x)`.
 */
export function sanitizeLegalHtml(input: string | null | undefined): string {
  if (!input) return ''
  const html = input.replace(/\0/g, '')
  const stack: string[] = []
  let out = ''
  let i = 0
  let dropDepth = 0
  let dropTag = ''

  while (i < html.length) {
    const lt = html.indexOf('<', i)
    if (lt === -1) {
      if (dropDepth === 0) out += escapeText(html.slice(i))
      break
    }
    if (lt > i && dropDepth === 0) out += escapeText(html.slice(i, lt))
    i = lt

    // Commentaires, CDATA, doctypes, instructions de traitement : supprimés.
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4)
      i = end === -1 ? html.length : end + 3
      continue
    }
    if (html.startsWith('<!', i) || html.startsWith('<?', i)) {
      const end = html.indexOf('>', i)
      i = end === -1 ? html.length : end + 1
      continue
    }

    const m = TAG_RE.exec(html.slice(i))
    if (!m) {
      // « < » isolé (ex. « a < b ») : du texte.
      if (dropDepth === 0) out += '&lt;'
      i++
      continue
    }
    i += m[0].length
    const closing = m[1] === '/'
    const tag = (m[2] ?? '').toLowerCase()
    const rawAttrs = m[3] ?? ''

    if (dropDepth > 0) {
      if (tag === dropTag) dropDepth += closing ? -1 : rawAttrs.trimEnd().endsWith('/') ? 0 : 1
      continue
    }
    if (DROP_WITH_CONTENT.has(tag)) {
      if (!closing && !rawAttrs.trimEnd().endsWith('/')) {
        dropDepth = 1
        dropTag = tag
      }
      continue
    }
    if (UNWRAP.has(tag) || !(tag in ALLOWED)) continue

    if (VOID.has(tag)) {
      if (!closing) out += `<${tag}>`
      continue
    }
    if (!closing) {
      out += renderOpenTag(tag, rawAttrs)
      stack.push(tag)
      continue
    }
    // Fermeture : seulement si la balise est ouverte ; on ferme au passage les balises imbriquées.
    const idx = stack.lastIndexOf(tag)
    if (idx === -1) continue
    while (stack.length > idx) out += `</${stack.pop()}>`
  }
  while (stack.length > 0) out += `</${stack.pop()}>`
  return out
}
