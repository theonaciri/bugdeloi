#!/usr/bin/env python3
"""Pont vers OpenFisca-France pour le différentiel C0.8.

Usage : compare_openfisca.py [scenarios.json]   (sans argument : lit stdin)

Entrée : une liste JSON de foyers (voir `Scenario` dans scenarios.ts).
Sortie : un unique objet JSON sur stdout.

- succès : {"status": "ok", "versions", "periode", "parametres", "results"} ;
- échec  : {"status": "error", "code", "message"}, code de sortie non nul
  (2 : entrée invalide, 3 : openfisca-france absent, 1 : échec du calcul).

Périmètre : le revenu net imposable (`rni`) et la base de ressources des
prestations familiales sont injectés directement. Ni leur construction depuis les
revenus bruts, ni le décalage N-2 des ressources ne sont donc comparés.

OpenFisca-France est importé comme bibliothèque ; aucun de ses codes n'est recopié.
"""

import contextlib
import json
import sys
from importlib import metadata

PERIODE_DEMANDEE = 2025
# c0.7 modélise le droit au 1er juillet 2026 : les allocations sont évaluées sur ce mois, × 12.
MOIS_AF = "2026-07"
SITUATIONS = {
    "Célibataire": "celibataire",
    "Divorcé": "divorce",
    "Veuf": "veuf",
    "ImpositionCommune": "marie",
}
# Variable de résidence fiscale (impôt) et code commune (prestations) par domicile.
DOMICILES = {
    "Métropole": (None, None),
    "GuadeloupeMartiniqueRéunion": ("residence_fiscale_guadeloupe", "97105"),
    "GuyaneMayotte": ("residence_fiscale_guyane", "97302"),
}


class EntreeInvalide(ValueError):
    pass


def emettre(objet, code=0):
    json.dump(objet, sys.stdout, ensure_ascii=False, allow_nan=False)
    sys.stdout.write("\n")
    sys.exit(code)


def erreur(code, message, sortie):
    emettre({"status": "error", "code": code, "message": message}, sortie)


def entier_positif(valeur):
    return type(valeur) is int and valeur >= 0


def valider(scenarios):
    if not isinstance(scenarios, list):
        raise EntreeInvalide("La racine doit être une liste de foyers.")
    vus = set()
    for index, s in enumerate(scenarios):
        ou = f"foyer n°{index}"
        if not isinstance(s, dict):
            raise EntreeInvalide(f"{ou} : un objet est attendu.")
        identifiant = s.get("id")
        if not isinstance(identifiant, str) or not identifiant or identifiant in vus:
            raise EntreeInvalide(f"{ou} : `id` absent, vide ou en double.")
        vus.add(identifiant)
        if s.get("domaine") not in ("ir", "af"):
            raise EntreeInvalide(f"{identifiant} : `domaine` doit valoir ir ou af.")
        if s.get("situationFamiliale") not in SITUATIONS:
            raise EntreeInvalide(f"{identifiant} : `situationFamiliale` inconnue.")
        if s.get("domicileFiscal") not in DOMICILES:
            raise EntreeInvalide(f"{identifiant} : `domicileFiscal` inconnu.")
        if type(s.get("appreciationVitSeul")) is not bool:
            raise EntreeInvalide(f"{identifiant} : `appreciationVitSeul` doit être un booléen.")
        if not entier_positif(s.get("revenuEuros")):
            raise EntreeInvalide(f"{identifiant} : `revenuEuros` doit être un entier positif ou nul.")
        ages = s.get("agesEnfants")
        if not isinstance(ages, list) or not all(entier_positif(a) and a <= 25 for a in ages):
            raise EntreeInvalide(f"{identifiant} : `agesEnfants` doit lister des âges de 0 à 25.")


def historique(parametre):
    """Valeurs successives d'un paramètre OpenFisca, de la plus ancienne à la plus récente."""
    valeurs = [
        {"date": v.instant_str, "valeur": float(v.value)}
        for v in parametre.values_list
        if v.value is not None
    ]
    return sorted(valeurs, key=lambda v: v["date"])


def periode_utilisee(tbs):
    seuils = tbs.parameters.impot_revenu.bareme_ir_depuis_1945.bareme.brackets
    derniere = max(int(v.instant_str[:4]) for b in seuils for v in b.threshold.values_list)
    return min(PERIODE_DEMANDEE, derniere)


def parametres_ir(tbs, annee):
    p = tbs.get_parameters_at_instant(f"{annee}-01-01").impot_revenu
    qf = p.calcul_impot_revenu.plaf_qf
    plafonds = qf.plafond_avantages_procures_par_demi_part
    bareme = p.bareme_ir_depuis_1945.bareme
    recouvrement = p.calcul_impot_revenu.recouvrement
    return {
        # La première tranche (seuil 0, taux 0) est omise.
        "seuils": [float(x) for x in bareme.thresholds[1:]],
        "taux": [round(float(x), 6) for x in bareme.rates[1:]],
        "decoteSeul": float(qf.decote.seuil_celib),
        "decoteCouple": float(qf.decote.seuil_couple),
        "decoteTaux": round(float(qf.decote.taux), 6),
        "plafondDemiPart": float(plafonds.general),
        "plafondParentIsole": float(plafonds.celib_enf),
        "reductionVeuf": float(plafonds.reduc_postplafond_veuf),
        "domGmrPlafond": float(qf.abat_dom.guadeloupe_martinique_reunion.plaf),
        "domGmrTaux": round(float(qf.abat_dom.guadeloupe_martinique_reunion.taux), 6),
        "domGmPlafond": float(qf.abat_dom.guyane_mayotte.plaf),
        "domGmTaux": round(float(qf.abat_dom.guyane_mayotte.taux), 6),
        "seuilRecouvrement": float(recouvrement.min_avant_credits_impots),
    }


def parametres_af(tbs):
    pf = tbs.get_parameters_at_instant(f"{MOIS_AF}-01").prestations_sociales.prestations_familiales
    ressources = pf.prestations_generales.af.af_cond_ress
    mois = {
        "mois": MOIS_AF,
        "bmafMensuelleEuros": float(pf.bmaf.bmaf),
        "plafond1BaseEuros": float(ressources.plafond_tranche_1_base),
        "plafond2BaseEuros": float(ressources.plafond_tranche_2_base),
        "majorationPlafondParEnfantEuros": float(ressources.majoration_plafond_par_enfant_supplementaire),
    }
    pf = tbs.parameters.prestations_sociales.prestations_familiales
    ressources = pf.prestations_generales.af.af_cond_ress
    return {
        "mois": mois,
        "historique": {
            "bmafMensuelleEuros": historique(pf.bmaf.bmaf),
            "plafond1BaseEuros": historique(ressources.plafond_tranche_1_base),
            "plafond2BaseEuros": historique(ressources.plafond_tranche_2_base),
            "majorationPlafondParEnfantEuros": historique(ressources.majoration_plafond_par_enfant_supplementaire),
        },
    }


def situation(s, annee):
    mois = [f"{annee}-{m:02d}" for m in range(1, 13)] if s["domaine"] == "ir" else [MOIS_AF]
    annuel = str(annee)
    couple = s["situationFamiliale"] == "ImpositionCommune"
    adultes = ["adulte1", "adulte2"] if couple else ["adulte1"]
    enfants = [f"enfant{i + 1}" for i in range(len(s["agesEnfants"]))]

    individus = {}
    for nom in adultes:
        individus[nom] = {
            "age": {m: 40 for m in mois},
            "statut_marital": {m: SITUATIONS[s["situationFamiliale"]] for m in mois},
        }
    for nom, age in zip(enfants, s["agesEnfants"]):
        individus[nom] = {"age": {m: age for m in mois}}

    foyer = {"declarants": adultes, "personnes_a_charge": enfants}
    famille = {"parents": adultes, "enfants": enfants}
    menage = {"personne_de_reference": [adultes[0]], "conjoint": adultes[1:], "enfants": enfants}
    residence, commune = DOMICILES[s["domicileFiscal"]]
    if commune:
        menage["depcom"] = {m: commune for m in mois}

    if s["domaine"] == "ir":
        foyer["rni"] = {annuel: s["revenuEuros"]}
        # Case T (parent isolé) : seulement dans le cas modélisé par c0.6.
        foyer["caseT"] = {
            annuel: s["appreciationVitSeul"]
            and bool(enfants)
            and s["situationFamiliale"] in ("Célibataire", "Divorcé")
        }
        for variable, _ in DOMICILES.values():
            if variable:
                foyer[variable] = {annuel: variable == residence}
    else:
        famille["prestations_familiales_base_ressources"] = {m: s["revenuEuros"] for m in mois}

    return {
        "individus": individus,
        "foyers_fiscaux": {"foyer": foyer},
        "familles": {"famille": famille},
        "menages": {"menage": menage},
    }


def evaluer(tbs, builder, s, annee):
    simulation = builder().build_from_entities(tbs, situation(s, annee))
    annuel = str(annee)
    resultat = {"id": s["id"], "impot_revenu": None, "af": None, "details": {}}

    def valeur(variable):
        return round(float(simulation.calculate(variable, annuel)[0]), 4)

    def annualise(variable):
        return round(12 * float(simulation.calculate(variable, MOIS_AF)[0]), 4)

    if s["domaine"] == "ir":
        # OpenFisca compte l'impôt restant à payer en négatif ; on renvoie le montant dû.
        resultat["impot_revenu"] = 0.0 - valeur("impot_revenu_restant_a_payer")
        resultat["details"] = {
            variable: valeur(variable)
            for variable in (
                "nbptr",
                "ir_brut",
                "ir_plaf_qf",
                "decote_gain_fiscal",
                "ip_net",
                "contribution_exceptionnelle_hauts_revenus",
            )
        }
    else:
        resultat["af"] = annualise("af")
        resultat["details"] = {
            variable: annualise(variable)
            for variable in (
                "af_base",
                "af_majoration",
                "af_allocation_forfaitaire",
                "af_complement_degressif",
                "af_allocation_forfaitaire_complement_degressif",
            )
        }
    return resultat


def main(argv):
    try:
        if len(argv) > 1:
            with open(argv[1], encoding="utf-8") as fichier:
                scenarios = json.load(fichier)
        else:
            scenarios = json.load(sys.stdin)
        valider(scenarios)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, EntreeInvalide) as exc:
        erreur("invalid_input", str(exc), 2)

    try:
        # Tout affichage de la bibliothèque part sur stderr : stdout ne porte que le JSON.
        with contextlib.redirect_stdout(sys.stderr):
            from openfisca_core.simulation_builder import SimulationBuilder
            from openfisca_france import CountryTaxBenefitSystem
    except ModuleNotFoundError as exc:
        if exc.name and exc.name.split(".")[0] in ("openfisca_france", "openfisca_core"):
            erreur(
                "openfisca_france_not_installed",
                "openfisca_france n'est pas installé pour cet interpréteur. Voir "
                "replications/c0.8-openfisca/README.md.",
                3,
            )
        erreur("import_failed", f"Dépendance absente : {exc.name}", 1)
    except Exception as exc:  # noqa: BLE001 - toute panne d'import doit rester structurée
        erreur("import_failed", f"{type(exc).__name__}: {exc}", 1)

    try:
        with contextlib.redirect_stdout(sys.stderr):
            tbs = CountryTaxBenefitSystem()
            annee = periode_utilisee(tbs)
            sortie = {
                "status": "ok",
                "versions": {
                    "openfisca_france": metadata.version("openfisca-france"),
                    "openfisca_core": metadata.version("openfisca-core"),
                    "numpy": metadata.version("numpy"),
                    "python": ".".join(str(n) for n in sys.version_info[:3]),
                },
                "periode": {"demandee": PERIODE_DEMANDEE, "utilisee": annee, "moisAF": MOIS_AF},
                "parametres": {"ir": parametres_ir(tbs, annee), "af": parametres_af(tbs)},
                "results": [evaluer(tbs, SimulationBuilder, s, annee) for s in scenarios],
            }
    except Exception as exc:  # noqa: BLE001
        erreur("evaluation_failed", f"{type(exc).__name__}: {exc}", 1)
    emettre(sortie)


if __name__ == "__main__":
    main(sys.argv)
