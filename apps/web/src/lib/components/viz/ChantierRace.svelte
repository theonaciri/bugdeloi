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

<div class="space-y-6">
  <div class="divide-y divide-obs-line/70 border-y border-obs-line/80">
    {#each tracks as track (track.id)}
      <div class="grid gap-4 py-5 lg:grid-cols-[17rem_1fr_15rem] lg:items-center lg:gap-8">
        <div class="min-w-0">
          <a
            href={track.href}
            class="font-medium text-base text-obs-ink no-underline hover:text-obs-emerald hover:underline"
          >
            {track.title}
          </a>
          <p class="mt-0.5 text-xs text-obs-muted truncate">{track.subtitle}</p>
        </div>

        <div class="relative flex items-center" role="list" aria-label={`Jalons de ${track.title}`}>
          <div class="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-obs-line-strong/80" aria-hidden="true"></div>
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
                    'group relative flex size-8 items-center justify-center rounded-full cursor-pointer transition-transform hover:scale-115 focus-visible:scale-115',
                    isSelected && 'ring-2 ring-obs-amber ring-offset-2 ring-offset-obs-bg',
                  )}
                >
                  {#if rung.state === 'done'}
                    <span class="size-2.5 rounded-full bg-obs-ink shadow-[0_0_8px_rgba(244,240,232,0.45)]"></span>
                  {:else if rung.state === 'active'}
                    <span class="relative flex size-4 items-center justify-center rounded-full border-2 border-obs-emerald bg-obs-bg">
                      <span class="size-1.5 rounded-full bg-obs-emerald"></span>
                    </span>
                  {:else if rung.state === 'blocked'}
                    <span class="relative flex size-4.5 items-center justify-center rounded-full border-2 border-obs-amber bg-obs-bg">
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
            <p class={cn('text-sm font-semibold tabular', badgeTone[track.statusTone])}>
              {track.statusBadge}
            </p>
            <p class="text-xs text-obs-muted">{track.summary}</p>
          </div>
        </div>
      </div>
    {/each}
  </div>

  <div class="flex flex-wrap items-center justify-between gap-4 text-xs text-obs-muted">
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
      <span class="inline-flex items-center gap-2">
        <span class="size-2.5 rounded-full bg-obs-ink"></span>
        <span>Étape vérifiée</span>
      </span>
      <span class="inline-flex items-center gap-2">
        <span class="size-3 rounded-full border-2 border-obs-amber"></span>
        <span>Décision humaine attendue</span>
      </span>
      <span class="inline-flex items-center gap-2">
        <span class="size-2.5 rounded-full border border-obs-line-strong"></span>
        <span>Prochaine étape</span>
      </span>
    </div>
    <span>Cliquez sur un jalon pour lire son détail</span>
  </div>

  {#if selected}
    <div class="rounded-[var(--radius-lg)] bg-obs-surface p-5 sm:p-6 text-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-wider text-obs-muted">{selected.track.title}</p>
          <p class="font-display mt-0.5 text-xl font-semibold text-obs-ink">{selected.rung.label}</p>
        </div>
        {#if selected.rung.href ?? selected.track.href}
          <a
            href={selected.rung.href ?? selected.track.href}
            class="inline-flex items-center gap-1.5 text-sm font-semibold text-obs-emerald no-underline hover:underline"
          >
            Ouvrir la fiche
            <ArrowRight class="size-4" aria-hidden="true" />
          </a>
        {/if}
      </div>
      <p class="mt-2.5 max-w-3xl text-sm leading-relaxed text-obs-muted">{selected.rung.detail}</p>
    </div>
  {/if}
</div>
