<script lang="ts">
import { ArrowRight } from '@lucide/svelte'
import { cn } from '#lib/utils/cn.ts'

export type RungState = 'done' | 'active' | 'blocked' | 'todo'

export interface RaceRung {
  id: string
  label: string
  state: RungState
  detail: string
  href?: string
}

export interface RaceTrack {
  id: string
  title: string
  subtitle: string
  summary: string
  statusBadge: string
  statusTone: 'emerald' | 'amber' | 'cobalt' | 'muted'
  href: string
  rungs: RaceRung[]
}

let {
  tracks,
}: {
  tracks: RaceTrack[]
} = $props()

let selected = $state<{ track: RaceTrack; rung: RaceRung } | null>(null)

const badgeTone: Record<RaceTrack['statusTone'], string> = {
  emerald: 'text-obs-emerald',
  amber: 'text-obs-amber',
  cobalt: 'text-obs-cobalt',
  muted: 'text-obs-muted',
}
</script>

<div class="space-y-4">
  <div class="divide-y divide-obs-line/80 border-y border-obs-line">
    {#each tracks as track (track.id)}
      <div class="grid gap-3 py-4 lg:grid-cols-[15rem_1fr_15rem] lg:items-center lg:gap-6">
        <div class="min-w-0">
          <a
            href={track.href}
            class="font-medium text-sm text-obs-ink no-underline hover:text-obs-emerald hover:underline"
          >
            {track.title}
          </a>
          <p class="mt-0.5 text-xs text-obs-muted truncate">{track.subtitle}</p>
        </div>

        <!-- Piste de jalons cliquables -->
        <div class="relative flex items-center" role="list" aria-label={`Jalons de ${track.title}`}>
          <div class="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-obs-line-strong" aria-hidden="true"></div>
          <div class="relative flex w-full items-center justify-between gap-2">
            {#each track.rungs as rung (rung.id)}
              {@const isSelected = selected?.rung.id === rung.id && selected?.track.id === track.id}
              <div role="listitem">
                <button
                  type="button"
                  aria-label={`${track.title} · ${rung.label} : ${rung.detail}`}
                  aria-pressed={isSelected}
                  onclick={() => (selected = isSelected ? null : { track, rung })}
                  class={cn(
                    'group relative flex size-7 items-center justify-center rounded-full cursor-pointer transition-transform hover:scale-115 focus-visible:scale-115',
                    isSelected && 'ring-2 ring-obs-amber ring-offset-2 ring-offset-obs-bg',
                  )}
                >
                  {#if rung.state === 'done'}
                    <span class="size-2.5 rounded-full bg-obs-emerald shadow-[0_0_10px_rgba(52,211,153,0.65)]"></span>
                  {:else if rung.state === 'active'}
                    <span class="relative flex size-4 items-center justify-center rounded-full border-2 border-obs-cobalt bg-obs-bg">
                      <span class="size-1.5 rounded-full bg-obs-cobalt"></span>
                    </span>
                  {:else if rung.state === 'blocked'}
                    <span class="relative flex size-4.5 items-center justify-center rounded-full border-2 border-obs-amber bg-obs-bg shadow-[0_0_12px_rgba(251,191,36,0.45)]">
                      <span class="size-1.5 rounded-full bg-obs-amber"></span>
                    </span>
                  {:else}
                    <span class="size-2.5 rounded-full border border-obs-line-strong bg-obs-bg"></span>
                  {/if}
                  <span class="sr-only">{rung.label}</span>
                </button>
              </div>
            {/each}
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 lg:justify-end">
          <div class="text-left lg:text-right">
            <p class={cn('mono text-xs font-semibold tabular', badgeTone[track.statusTone])}>
              {track.statusBadge}
            </p>
            <p class="text-[0.72rem] text-obs-muted">{track.summary}</p>
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Légende + inspecteur du jalon sélectionné -->
  <div class="flex flex-wrap items-center justify-between gap-4 text-xs text-obs-muted">
    <div class="flex flex-wrap items-center gap-x-5 gap-y-1.5">
      <span class="inline-flex items-center gap-2">
        <span class="size-2.5 rounded-full bg-obs-emerald"></span>
        <span>Jalon vérifié / rejoué</span>
      </span>
      <span class="inline-flex items-center gap-2">
        <span class="size-3 rounded-full border-2 border-obs-cobalt"></span>
        <span>En cours d’audit</span>
      </span>
      <span class="inline-flex items-center gap-2">
        <span class="size-3 rounded-full border-2 border-obs-amber"></span>
        <span>Verdict humain attendu</span>
      </span>
      <span class="inline-flex items-center gap-2">
        <span class="size-2.5 rounded-full border border-obs-line-strong"></span>
        <span>Étape suivante</span>
      </span>
    </div>
    <span class="mono text-[0.7rem]">Cliquez sur un jalon pour inspecter son état</span>
  </div>

  {#if selected}
    <div class="rounded-[var(--radius)] border border-obs-line-strong bg-obs-surface p-4 text-sm">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="mono text-[0.7rem] uppercase tracking-wider text-obs-muted">{selected.track.title}</p>
          <p class="mt-0.5 font-semibold text-obs-ink">{selected.rung.label}</p>
        </div>
        {#if selected.rung.href ?? selected.track.href}
          <a
            href={selected.rung.href ?? selected.track.href}
            class="inline-flex items-center gap-1.5 text-xs font-semibold text-obs-emerald no-underline hover:underline"
          >
            Ouvrir la fiche
            <ArrowRight class="size-3.5" aria-hidden="true" />
          </a>
        {/if}
      </div>
      <p class="mt-2 text-xs leading-relaxed text-obs-muted">{selected.rung.detail}</p>
    </div>
  {/if}
</div>
