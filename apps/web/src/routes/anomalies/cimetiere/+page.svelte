<script lang="ts">
import { VERDICT_LABEL } from '@bugdeloi/core/findings'
import { formatDateTime } from '#lib/format.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
</script>

<svelte:head>
  <title>Cimetière des signalements écartés · BugDeLoi</title>
  <meta name="description" content="Les signalements écartés par un juriste, avec le motif de chaque décision." />
</svelte:head>

<header class="bg-bg">
  <div class="container-wide space-y-5 py-12 sm:py-16">
    <p class="text-sm"><a href="/anomalies">← Retour aux anomalies</a></p>
    <h1 class="text-4xl tracking-tight sm:text-5xl">Cimetière des signalements écartés</h1>
    <p class="max-w-3xl font-display text-xl leading-relaxed text-ink/90">
      Un juriste peut écarter un signalement parce que le renvoi à une ancienne loi était volontaire
      ou parce que notre programme a fait une erreur. Nous conservons ces dossiers et le motif de
      chaque décision pour que chacun puisse comprendre pourquoi ces signalements ont été écartés.
    </p>
  </div>
</header>

<section class="border-t border-line bg-surface" aria-label="Signalements écartés et motifs">
  <div class="container-wide py-12 sm:py-16">
    {#if data.findings.length > 0}
      <ul class="max-w-4xl divide-y divide-line border-y border-line">
        {#each data.findings as item (item.id)}
          <li class="space-y-2 py-5">
            <h2 class="text-xl"><a href="/anomalies/{item.id}">{item.typeLabel}</a></h2>
            <p class="mono text-xs text-muted">{item.id}</p>
            <p>{item.claim}</p>
            <p class="text-sm text-muted">
              {VERDICT_LABEL[item.qualification.verdict]} · @{item.qualification.reviewer} ·
              <time datetime={item.qualification.qualified_at}>{formatDateTime(item.qualification.qualified_at)}</time>
            </p>
            <p class="whitespace-pre-wrap">{item.qualification.note}</p>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-muted">Aucun signalement n’a encore été écarté par un juriste à ce jour.</p>
    {/if}
  </div>
</section>
