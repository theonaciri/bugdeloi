<script lang="ts">
import { VERDICT_LABEL } from '@bugdeloi/core/findings'
import { formatDateTime } from '#lib/format.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
</script>

<svelte:head><title>Cimetière des constats rejetés · BugDeLoi</title></svelte:head>

<div class="container-page mt-8">
  <p class="mb-3"><a href="/anomalies">Anomalies qualifiées</a></p>
  <h1 class="text-3xl font-semibold sm:text-4xl">Cimetière des constats rejetés</h1>
  <p class="mt-2 text-muted">Les constats rejetés par un humain sont conservés avec leur motif.</p>

  {#if data.findings.length}
    <ul class="mt-6 grid max-w-4xl gap-3">
      {#each data.findings as item (item.id)}
        <li class="card p-4">
          <p class="text-sm text-muted">{item.typeLabel}</p>
          <h2 class="mt-1 text-lg font-semibold"><a href="/anomalies/{item.id}">{item.id}</a></h2>
          <p>{item.claim}</p>
          <p class="mt-2 text-sm">
            {VERDICT_LABEL[item.qualification.verdict]} · @{item.qualification.reviewer} ·
            <time datetime={item.qualification.qualified_at}>{formatDateTime(item.qualification.qualified_at)}</time>
          </p>
          <p class="mt-2 whitespace-pre-wrap">{item.qualification.note}</p>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="mt-6">Aucun verdict humain de rejet à ce jour.</p>
  {/if}
</div>
