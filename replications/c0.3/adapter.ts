import { join } from 'node:path'

const territories = {
  Métropole: 'FranceMétropolitaine',
  Guadeloupe: 'DépartementGuadeloupe',
  Guyane: 'DépartementGuyane',
  Martinique: 'DépartementMartinique',
  LaRéunion: 'DépartementRéunion',
  Mayotte: 'DépartementMayotte',
  SaintBarthélemy: 'CollectivitéBarthélemy',
  SaintMartin: 'CollectivitéMartin',
  SaintPierreEtMiquelon: 'CollectivitéPierreMiquelon',
}

const charges = {
  EffectiveEtPermanente: 'ChargePermanente',
  GardeAlternéePartageAllocations: 'RésidenceAlternéePartagée',
  GardeAlternéeAllocataireUnique: 'RésidenceAlternéeUnique',
  ServicesSociauxAllocationVerséeÀLaFamille: 'PlacementVersementFamille',
  ServicesSociauxAllocationVerséeAuxServicesSociaux: 'PlacementVersementService',
}

const schools = { Avant: 'PrécèdeObligation', Pendant: 'RelèveObligation', Après: 'SuitObligation' }

const childFields = [
  ['d_identifiant', 'identifiant', 'numéro_dossier', 'entier'],
  ['d_date_de_naissance', 'date_de_naissance', 'naissance', 'date'],
  ['d_rémuneration_mensuelle', 'rémuneration_mensuelle', 'salaire_mensuel', 'argent'],
  ['d_prise_en_charge', 'prise_en_charge', 'appréciation_charge', 'PriseEnCharge'],
  [
    'd_a_déjà_ouvert_droit_aux_allocations_familiales',
    'a_déjà_ouvert_droit_aux_allocations_familiales',
    'droit_antérieur',
    'booléen',
  ],
  [
    'd_bénéficie_titre_personnel_aide_personnelle_logement',
    'bénéficie_titre_personnel_aide_personnelle_logement',
    'aide_logement_personnelle',
    'booléen',
  ],
] as const

const household = [
  ['i_date_courante', 'jour_de_droit', 'date'],
  ['i_ressources_ménage', 'revenu_annuel_de_référence', 'argent'],
  ['i_personne_charge_effective_permanente_est_parent', 'appréciation_parent_en_charge', 'condition'],
  [
    'i_personne_charge_effective_permanente_remplit_titre_I',
    'appréciation_conditions_générales',
    'condition',
  ],
  ['i_avait_enfant_à_charge_avant_1er_janvier_2012', 'charge_antérieure_au_régime_transitoire', 'condition'],
] as const

function convert(value: string, from: string, to: string, variants: Record<string, string>, inverse = false) {
  return `(selon ${value} sous forme\n${Object.entries(variants)
    .map(([left, right]) => `    -- ${from}.${inverse ? right : left}: ${to}.${inverse ? left : right}`)
    .join('\n')})`
}

function childRecord(value: string, single: boolean, inverse = false) {
  const type = inverse ? (single ? 'Reference.Enfant' : 'Reference.EnfantEntrée') : 'Calcul.SituationEnfant'
  const fields = childFields.map(([main, direct, neutral, fieldType]) => {
    const legacy = single ? direct : main
    const path = `${value}.${inverse ? neutral : legacy}`
    const expression =
      fieldType === 'PriseEnCharge'
        ? convert(
            path,
            inverse ? 'ChargeEnfant' : 'PriseEnCharge',
            inverse ? 'Reference.PriseEnCharge' : 'Calcul.ChargeEnfant',
            charges,
            inverse,
          )
        : path
    return `    -- ${inverse ? legacy : neutral}: ${expression}`
  })
  if (single && inverse) {
    fields.push(
      `    -- obligation_scolaire: ${convert('état_de_scolarité', 'Scolarité', 'Reference.SituationObligationScolaire', schools, true)}`,
    )
  }
  return `${type} {\n${fields.join('\n')}\n  }`
}

function enumDeclaration(type: string, variants: Record<string, string>) {
  return `déclaration énumération ${type}:\n${Object.keys(variants)
    .map((key) => `  -- ${key}`)
    .join('\n')}`
}

function childDeclaration(single: boolean) {
  const fields = childFields.map(
    ([main, direct, , type]) => `  donnée ${single ? direct : main} contenu ${type}`,
  )
  if (single) fields.push('  donnée obligation_scolaire contenu SituationObligationScolaire')
  return `déclaration structure ${single ? 'Enfant' : 'EnfantEntrée'}:\n${fields.join('\n')}`
}

export const sourceFolder = 'allocations_familiales'
export const referenceEntry = 'Allocations_familiales.catala_fr'

export async function buildAdapter(sourceDir: string) {
  const original = await Bun.file(join(sourceDir, sourceFolder, referenceEntry)).text()
  const inline = original.match(/^```catala-test-cli\n[\s\S]*?^```$/m)?.[0]
  if (!inline) throw new Error('Test structurel Inria absent.')
  return `> Module Allocations_familiales
> Usage de France
> Usage de Calcul
> Usage de Baremes

\`\`\`catala-metadata
${enumDeclaration('PriseEnCharge', charges)}

${enumDeclaration('SituationObligationScolaire', schools)}

${childDeclaration(false)}

${childDeclaration(true)}

déclaration champ d'application InterfaceAllocationsFamiliales:
${household.map(([source, , type]) => `  entrée ${source} ${type === 'condition' ? type : `contenu ${type}`}`).join('\n')}
  entrée i_résidence contenu France.Collectivité
  entrée i_enfants contenu liste de EnfantEntrée
  résultat i_montant_versé contenu argent
  baremes champ d'application Baremes.Parametres
  calcul champ d'application Calcul.CalculMensuel

déclaration champ d'application PrestationsFamiliales:
  entrée date_courante contenu date
  entrée résidence contenu France.Collectivité
  résultat droit_ouvert condition dépend de enfant contenu Enfant
  baremes champ d'application Baremes.Parametres

\`\`\`

\`\`\`catala
champ d'application InterfaceAllocationsFamiliales:
  définition baremes.date_barème égal à i_date_courante
  définition baremes.résidence égal à i_résidence
${household.map(([source, neutral]) => `  définition calcul.${neutral} égal à ${source}`).join('\n')}
  définition calcul.territoire_du_foyer égal à
    ${convert('i_résidence', 'France.Collectivité', 'Calcul.Territoire', territories)}
  définition calcul.personnes_à_charge égal à
    transforme chaque personne parmi i_enfants en ${childRecord('personne', false)}
  définition calcul.base_mensuelle_de_calcul égal à baremes.base
  définition calcul.minimum_horaire_brut égal à baremes.smic
  définition calcul.premier_plafond_hors_enfants égal à baremes.premier
  définition calcul.second_plafond_hors_enfants égal à baremes.second
  définition calcul.majoration_plafonds_par_enfant égal à baremes.majoration
  définition i_montant_versé égal à calcul.allocation_mensuelle

champ d'application PrestationsFamiliales:
  définition baremes.date_barème égal à date_courante
  définition baremes.résidence égal à résidence
  définition droit_ouvert de enfant égal à
    (résultat de Calcul.OuverturePourEnfant avec {
      -- date_du_droit: date_courante
      -- territoire_de_résidence: ${convert('résidence', 'France.Collectivité', 'Calcul.Territoire', territories)}
      -- situation_individuelle: ${childRecord('enfant', true)}
      -- état_de_scolarité: ${convert('enfant.obligation_scolaire', 'SituationObligationScolaire', 'Calcul.Scolarité', schools)}
      -- salaire_minimum_horaire: baremes.smic
    }).droit_individuel
\`\`\`

${inline}
`
}

export function witness() {
  return `> Module Calcul
> Usage de France
> Usage de Reference
> Inclusion: interface.catala_fr

\`\`\`catala
champ d'application CalculMensuel:
  définition allocation_mensuelle égal à
    (résultat de Reference.InterfaceAllocationsFamiliales avec {
${household.map(([source, neutral]) => `      -- ${source}: ${neutral}`).join('\n')}
      -- i_résidence: ${convert('territoire_du_foyer', 'Territoire', 'France.Collectivité', territories, true)}
      -- i_enfants: transforme chaque personne parmi personnes_à_charge en ${childRecord('personne', false, true)}
    }).i_montant_versé

champ d'application OuverturePourEnfant:
  définition droit_individuel égal à
    ((résultat de Reference.PrestationsFamiliales avec {
      -- date_courante: date_du_droit
      -- résidence: ${convert('territoire_de_résidence', 'Territoire', 'France.Collectivité', territories, true)}
    }).droit_ouvert) de (${childRecord('situation_individuelle', true, true)})
\`\`\`
`
}
