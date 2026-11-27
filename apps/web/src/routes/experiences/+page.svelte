<script lang="ts">
import type { PageProps } from './$types'

let { data }: PageProps = $props()
</script>

<svelte:head>
  <title>Expériences d’étalonnage · BugDeLoi</title>
  <meta
    name="description"
    content="Comment BugDeLoi teste ses programmes et les intelligences artificielles sur des textes de loi réels : impôt sur le revenu 2026, allocations familiales et ambiguïtés connues."
  />
</svelte:head>

<section class="bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <h1 class="max-w-4xl text-4xl tracking-tight text-ink sm:text-5xl">
      Expériences
    </h1>
    <p class="mt-5 max-w-[68ch] text-lg leading-relaxed text-muted">
      Ces simulateurs et études comparatives servent à étalonner la méthode : détection d’effets de seuil, comparaison
      avec OpenFisca-France et mesure de l’effet d’un amendement en euros. Il s’agit de résultats de travail qui n’ont
      pas encore été qualifiés par un juriste.
    </p>
  </div>
</section>

<section class="border-t border-line bg-surface">
  <div class="container-wide py-12 sm:py-16">
    <ul class="divide-y divide-line border-y border-line">
      <li class="grid gap-4 py-8 lg:grid-cols-12 lg:items-baseline">
        <div class="lg:col-span-8">
          <h2 class="text-2xl text-ink sm:text-3xl">
            <a href="/experiences/revenu-disponible" class="no-underline hover:underline">
              Revenu disponible : impôt, allocations, APL, RSA et prime d’activité
            </a>
          </h2>
          <p class="mt-2.5 max-w-[62ch] text-base leading-relaxed text-muted">
            Ce simulateur combine l’impôt sur le revenu 2026 (avec garde alternée et demi-parts de l’article 195), les
            allocations familiales, l’APL, le RSA et la prime d’activité. Le balayage euro par euro de 0 € à 100 000 €
            relève <strong>{data.c07.effetsDeSeuilEnBaisse} effets de seuil en baisse</strong> candidats, dont une chute
            de 1 055,96 € à 12 192 € à la sortie du RSA (CCH art. R822-17).
          </p>
          <p class="mt-3 text-sm font-medium text-brand-strong">
            Simulateur multi-dispositifs (C0.7) · exécuté dans le navigateur ·
            <a
              href="https://github.com/theonaciri/bugdeloi/blob/main/replications/c0.7/summary.json"
              rel="external"
              class="underline"
            >
              données brutes JSON
            </a>
          </p>
        </div>
        <div class="lg:col-span-4 lg:text-right">
          <a
            href="/experiences/revenu-disponible"
            class="inline-flex items-center rounded-[var(--radius)] bg-brand px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-brand-strong"
          >
            Ouvrir le simulateur →
          </a>
        </div>
      </li>

      <li class="grid gap-4 py-8 lg:grid-cols-12 lg:items-baseline">
        <div class="lg:col-span-8">
          <h2 class="text-2xl text-ink sm:text-3xl">
            <a href="/experiences/openfisca" class="no-underline hover:underline">
              Comparaison avec OpenFisca-France
            </a>
          </h2>
          <p class="mt-2.5 max-w-[62ch] text-base leading-relaxed text-muted">
            Comparaison automatique de nos moteurs sur <strong>{data.c08.foyersCompares} foyers</strong> face à
            OpenFisca-France {data.c08.openfiscaVersion} : 100 % d’accord exact sur les allocations familiales dans le
            périmètre, {data.c08.differencesPerimetre} différences de périmètre documentées et
            <strong>{data.c08.divergencesSimulateur} écarts d’arrondi</strong> qui mettent en évidence un candidat
            <code>ARRONDI</code> à 17 593 € (61 € contre 0 €).
          </p>
          <p class="mt-3 text-sm font-medium text-brand-strong">
            Oracle indépendant · 23 tests ·
            <a
              href="https://github.com/theonaciri/bugdeloi/blob/main/replications/c0.8-openfisca/REPORT.md"
              rel="external"
              class="underline"
            >
              rapport complet
            </a>
          </p>
        </div>
        <div class="lg:col-span-4 lg:text-right">
          <a
            href="/experiences/openfisca"
            class="inline-flex items-center rounded-[var(--radius)] bg-brand px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-brand-strong"
          >
            Consulter la comparaison →
          </a>
        </div>
      </li>

      <li class="grid gap-4 py-8 lg:grid-cols-12 lg:items-baseline">
        <div class="lg:col-span-8">
          <h2 class="text-2xl text-ink sm:text-3xl">
            <a href="/experiences/parlement" class="no-underline hover:underline">
              Effet d’un amendement en euros
            </a>
          </h2>
          <p class="mt-2.5 max-w-[62ch] text-base leading-relaxed text-muted">
            Analyse automatique d’amendements au format ouvert Tricoteuses ciblant nos 7 articles formalisés (CGI et
            CSS). Toute clause non reconnue ou contradictoire bascule en <code>non_calculable</code>. Pour les autres,
            l’écart en euros est calculé sur quatre foyers types.
          </p>
          <p class="mt-3 text-sm font-medium text-brand-strong">
            42 tests unitaires · lecture stricte ·
            <a
              href="https://github.com/theonaciri/bugdeloi/tree/main/packages/parlement"
              rel="external"
              class="underline"
            >
              code packages/parlement
            </a>
          </p>
        </div>
        <div class="lg:col-span-4 lg:text-right">
          <a
            href="/experiences/parlement"
            class="inline-flex items-center rounded-[var(--radius)] bg-brand px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-brand-strong"
          >
            Consulter les exemples →
          </a>
        </div>
      </li>

      <li class="grid gap-4 py-8 lg:grid-cols-12 lg:items-baseline">
        <div class="lg:col-span-8">
          <h2 class="text-2xl text-ink sm:text-3xl">
            <a href="/experiences/impot-revenu" class="no-underline hover:underline">
              Impôt sur le revenu 2026 : simulateur et effets de seuil
            </a>
          </h2>
          <p class="mt-2.5 max-w-[62ch] text-base leading-relaxed text-muted">
            Formalisation en Catala des articles 193, 194, 197 et 1657 en vigueur en 2026, accompagnée d’un simulateur
            dans le navigateur et d’un balayage au pas de 1 € sur quatre foyers types. Le détecteur retrouve le taux
            marginal de {data.c06.decoteTme.toFixed(2).replace('.', ',')} % dans la décote, un pic à 43,58 % entre
            29 579 € et 29 594 €, et la falaise de 61 € (+6 100 %) due à l’article 1657 1 bis.
          </p>
          <p class="mt-3 text-sm font-medium text-brand-strong">
            14/14 tests Catala · 10 000 foyers en différentiel (0 divergence) · 93,75 % mutation · {data.c06.totalCliffs1657} falaises 61 €
          </p>
        </div>
        <div class="lg:col-span-4 lg:text-right">
          <a
            href="/experiences/impot-revenu"
            class="inline-flex items-center rounded-[var(--radius)] bg-brand px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-brand-strong"
          >
            Ouvrir le simulateur →
          </a>
        </div>
      </li>

      <li class="grid gap-4 py-8 lg:grid-cols-12 lg:items-baseline">
        <div class="lg:col-span-8">
          <h2 class="text-2xl text-ink sm:text-3xl">
            <a href="/experiences/allocations-familiales" class="no-underline hover:underline">
              Allocations familiales : traduction à l’aveugle
            </a>
          </h2>
          <p class="mt-2.5 max-w-[62ch] text-base leading-relaxed text-muted">
            Un modèle d’IA a reçu uniquement le texte officiel du Code de la sécurité sociale, sans accès au programme
            ni aux tests de l’Inria. Sur 17 cas officiels, 12 réussissent (dont 9 montants identiques au centime), 3
            diffèrent de 0,01 € par placement d’arrondi, et 2 écarts de fond (Guyane et Mayotte) attendent une relecture
            juridique.
          </p>
          <p class="mt-3 text-sm font-medium text-notice-ink">
            Résultat provisoire · en attente de relecture humaine
          </p>
        </div>
        <div class="lg:col-span-4 lg:text-right">
          <a href="/experiences/allocations-familiales" class="text-sm font-semibold">
            Consulter les 17 cas en euros →
          </a>
        </div>
      </li>

      <li class="grid gap-4 py-8 lg:grid-cols-12 lg:items-baseline">
        <div class="lg:col-span-8">
          <h2 class="text-2xl text-ink sm:text-3xl">
            Détection d’ambiguïtés connues (Inria et DGFiP)
          </h2>
          <p class="mt-2.5 max-w-[62ch] text-base leading-relaxed text-muted">
            Les équipes de l’Inria et de la DGFiP ont annoté {data.c04.totalGroundTruth} questions d’interprétation et
            dépendances à la doctrine fiscale dans leurs programmes publics, dont {data.c04.inPacket} portent sur des
            versions d’articles présentes en base. Sans accès aux travaux de l’Inria, un analyste IA aveugle
            (Gemini 4 Neon) en retrouve <strong>{data.c04.blindMatched} sur {data.c04.inPacket} ({data.c04.blindRecallPct.toFixed(2).replace('.', ',')} %)</strong>,
            contre {data.c04.baselineMatched} sur {data.c04.inPacket} ({data.c04.baselineRecallPct !== null ? `${data.c04.baselineRecallPct.toFixed(2).replace('.', ',')} %` : '0 %'})
            pour un détecteur purement mécanique.
          </p>
          <p class="mt-3 text-xs text-muted">
            Dénombrement observé (non une probabilité) · {data.c04.blindObservations} observations aveugles contrôlées sans fuite.
          </p>
        </div>
        <div class="lg:col-span-4 lg:text-right">
          <a
            href="https://github.com/theonaciri/bugdeloi/blob/main/replications/c0.4/REPORT.md"
            rel="external"
            class="text-sm font-semibold"
          >
            Lire le rapport C0.4 →
          </a>
        </div>
      </li>
    </ul>
  </div>
</section>
