<script lang="ts">
import { formatInt } from '#lib/format.ts'

interface Props {
  inForceArticles: number
  refArticles: number
  reproducedSignals: number
  openDeskTasks: number
}

let { inForceArticles, refArticles, reproducedSignals, openDeskTasks }: Props = $props()

const stages = $derived([
  {
    step: 'Étape 1',
    title: 'La loi officielle',
    metric: `${formatInt(inForceArticles)} articles`,
    status: 'Synchronisé chaque nuit',
    caption: 'Nous importons les codes officiels de Légifrance avec leur empreinte numérique.',
    href: '/carte',
    cta: 'Voir la carte',
    accent: 'brand',
  },
  {
    step: 'Étape 2',
    title: 'Traduction en formules',
    metric: `${formatInt(refArticles)} ★ + IR 2026`,
    status: '185 tests Catala verts',
    caption: 'Chaque règle de calcul devient un programme vérifiable, sans inventer de chiffre.',
    href: '/experiences/impot-revenu',
    cta: 'Essayer le simulateur',
    accent: 'brand',
  },
  {
    step: 'Étape 3',
    title: 'Contrôles & falaises',
    metric: `${formatInt(reproducedSignals)} signalements`,
    status: '4 falaises 61 € repérées',
    caption: 'Deux programmes indépendants traquent renvois abrogés, fautes et effets de seuil.',
    href: '/anomalies',
    cta: 'Voir les signalements',
    accent: 'amber',
  },
  {
    step: 'Étape 4',
    title: 'Simulateurs & juristes',
    metric: `${formatInt(openDeskTasks)} tâches ouvertes`,
    status: 'Guichet & MCP en ligne',
    caption: 'Les citoyens simulent en direct ; les juristes relisent et signent les verdicts.',
    href: '/live',
    cta: 'Suivre en direct',
    accent: 'ink',
  },
])
</script>

<div class="space-y-8">
  <!-- Illustration SVG éditoriale plein cadre : le parcours de la loi au simulateur -->
  <figure class="overflow-hidden rounded-2xl border border-line bg-surface p-5 sm:p-8">
    <svg
      viewBox="0 0 960 210"
      class="block h-auto w-full"
      role="img"
      aria-labelledby="pipeline-svg-title pipeline-svg-desc"
    >
      <title id="pipeline-svg-title">Comment fonctionne BugDeLoi : de la loi officielle au simulateur vérifié</title>
      <desc id="pipeline-svg-desc">
        Quatre étapes reliées : 1. Import quotidien des articles de Légifrance, 2. Traduction en programmes Catala testés,
        3. Détection automatique des renvois abrogés et falaises fiscales, 4. Simulateurs publics et relecture juridique.
      </desc>
      <defs>
        <marker id="pipe-arrow" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M1 1.5 L6.5 4 L1 6.5" fill="none" stroke="var(--brand)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </marker>
      </defs>

      <!-- Ligne de connexion continue -->
      <line x1="120" y1="82" x2="840" y2="82" stroke="var(--line-strong)" stroke-width="2" stroke-dasharray="5 5" />
      <line x1="210" y1="82" x2="262" y2="82" stroke="var(--brand)" stroke-width="2" marker-end="url(#pipe-arrow)" />
      <line x1="450" y1="82" x2="502" y2="82" stroke="var(--brand)" stroke-width="2" marker-end="url(#pipe-arrow)" />
      <line x1="690" y1="82" x2="742" y2="82" stroke="var(--brand)" stroke-width="2" marker-end="url(#pipe-arrow)" />

      <!-- Nœud 1 : Livre de loi (Légifrance) -->
      <g transform="translate(36, 22)">
        <rect x="0" y="0" width="168" height="120" rx="16" fill="var(--bg)" stroke="var(--line-strong)" stroke-width="1.2" />
        <!-- Icône livre ouvert -->
        <g transform="translate(64, 22)" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 6 C8 4, 14 4, 20 8 C26 4, 32 4, 38 6 L38 30 C32 28, 26 28, 20 32 C14 28, 8 28, 2 30 Z" />
          <line x1="20" y1="8" x2="20" y2="32" />
        </g>
        <text x="84" y="78" text-anchor="middle" fill="var(--ink)" font-size="14" font-weight="700" font-family="var(--font-serif)">Loi officielle</text>
        <text x="84" y="99" text-anchor="middle" fill="var(--muted)" font-size="11.5" font-family="var(--font-mono)">{formatInt(inForceArticles)} articles</text>
      </g>

      <!-- Nœud 2 : Programme Catala -->
      <g transform="translate(276, 22)">
        <rect x="0" y="0" width="168" height="120" rx="16" fill="var(--bg)" stroke="var(--brand)" stroke-width="1.5" />
        <!-- Icône code + coche -->
        <g transform="translate(64, 22)" fill="none" stroke="var(--brand-strong)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="12 10 4 18 12 26" />
          <polyline points="28 10 36 18 28 26" />
          <line x1="22" y1="8" x2="18" y2="28" />
        </g>
        <text x="84" y="78" text-anchor="middle" fill="var(--ink)" font-size="14" font-weight="700" font-family="var(--font-serif)">Formules testées</text>
        <text x="84" y="99" text-anchor="middle" fill="var(--brand-strong)" font-size="11.5" font-family="var(--font-mono)">{formatInt(refArticles)} ★ · IR 2026</text>
      </g>

      <!-- Nœud 3 : Détection d'écarts et falaises -->
      <g transform="translate(516, 22)">
        <rect x="0" y="0" width="168" height="120" rx="16" fill="var(--bg)" stroke="var(--notice-line)" stroke-width="1.5" />
        <!-- Icône courbe + seuil -->
        <g transform="translate(64, 22)" fill="none" stroke="var(--notice-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="2 28 14 28 14 14 26 14 38 6" />
          <circle cx="14" cy="14" r="3" fill="var(--notice-ink)" />
        </g>
        <text x="84" y="78" text-anchor="middle" fill="var(--ink)" font-size="14" font-weight="700" font-family="var(--font-serif)">Écarts &amp; falaises</text>
        <text x="84" y="99" text-anchor="middle" fill="var(--notice-ink)" font-size="11.5" font-family="var(--font-mono)">{formatInt(reproducedSignals)} vérifiés</text>
      </g>

      <!-- Nœud 4 : Citoyens, juristes & agents -->
      <g transform="translate(756, 22)">
        <rect x="0" y="0" width="168" height="120" rx="16" fill="var(--bg)" stroke="var(--line-strong)" stroke-width="1.2" />
        <!-- Icône balance / validation -->
        <g transform="translate(64, 22)" fill="none" stroke="var(--ok)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="20" cy="18" r="14" />
          <polyline points="14 18 18 22 27 13" />
        </g>
        <text x="84" y="78" text-anchor="middle" fill="var(--ink)" font-size="14" font-weight="700" font-family="var(--font-serif)">Public &amp; juristes</text>
        <text x="84" y="99" text-anchor="middle" fill="var(--ok)" font-size="11.5" font-family="var(--font-mono)">En ligne · {formatInt(openDeskTasks)} tâches</text>
      </g>

      <!-- Barre de progression synthétique en bas du schéma -->
      <text x="36" y="176" fill="var(--muted)" font-size="12" font-family="var(--font-sans)">
        État actuel : fondations, carte, balayage, simulateurs IR 2026 &amp; revenu disponible, worker nocturne et guichet actifs.
      </text>
      <rect x="36" y="188" width="888" height="6" rx="3" fill="var(--surface-2)" />
      <rect x="36" y="188" width="666" height="6" rx="3" fill="var(--brand)" />
    </svg>
  </figure>

  <!-- 4 colonnes explicatives sans bordures lourdes -->
  <ol class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
    {#each stages as s (s.step)}
      <li class="flex flex-col justify-between space-y-3 border-t border-line pt-5">
        <div class="space-y-1.5">
          <div class="flex items-baseline justify-between gap-2 text-xs">
            <span class="font-semibold text-muted">{s.step}</span>
            <span class="font-mono text-xs {s.accent === 'amber' ? 'text-notice-ink' : s.accent === 'brand' ? 'text-brand-strong' : 'text-ok'}">
              {s.status}
            </span>
          </div>
          <h3 class="font-serif text-xl font-semibold text-ink">{s.title}</h3>
          <p class="font-mono text-sm font-semibold text-ink tabular">{s.metric}</p>
          <p class="text-sm leading-relaxed text-muted">{s.caption}</p>
        </div>
        <p class="pt-1 text-sm">
          <a href={s.href} class="font-semibold text-brand-strong no-underline hover:underline">{s.cta} →</a>
        </p>
      </li>
    {/each}
  </ol>
</div>
