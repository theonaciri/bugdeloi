<script lang="ts">
let {
  title,
  description,
  from,
  to,
  relation,
  secondSource,
  detail,
}: {
  title: string
  description: string
  from: string
  to: string
  relation: string
  secondSource?: string
  detail?: string | null
} = $props()

const id = $props.id()
</script>

<svg viewBox="0 0 320 {secondSource ? 132 : detail ? 120 : 88}" role="img" aria-labelledby="{id}-title {id}-desc" class="block h-auto w-full max-w-md rounded-lg border border-line bg-surface">
  <title id="{id}-title">{title}</title>
  <desc id="{id}-desc">{description}{detail ? ` ${detail}.` : ''}</desc>
  {#if secondSource}
    <g class="fill-surface-2 stroke-line-strong">
      <rect x="10" y="12" width="141" height="34" rx="4" />
      <rect x="169" y="12" width="141" height="34" rx="4" />
      <rect x="73" y="83" width="174" height="37" rx="4" />
    </g>
    <path d="M80 46v17h160V46 M160 63v19m-4-5 4 5 4-5" class="fill-none stroke-brand-strong" />
    <g text-anchor="middle" font-size="12" class="fill-ink">
      <text x="80" y="33">{from}</text>
      <text x="240" y="33">{secondSource}</text>
      <text x="160" y="106">{to}</text>
    </g>
  {:else}
    <g class="fill-surface-2 stroke-line-strong">
      <rect x="10" y="31" width="131" height="41" rx="4" />
      <rect x="179" y="31" width="131" height="41" rx="4" />
    </g>
    <path d="M145 51h30m-5-5 5 5-5 5" class="fill-none stroke-brand-strong" />
    <g text-anchor="middle" font-size="11" class="fill-ink">
      <text x="75.5" y="55">{from}</text>
      <text x="244.5" y="55">{to}</text>
      <text x="160" y="21" class="fill-muted">{relation}</text>
      {#if detail}<text x="160" y="102">{detail}</text>{/if}
    </g>
  {/if}
</svg>
