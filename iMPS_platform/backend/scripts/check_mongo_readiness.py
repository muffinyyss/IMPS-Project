#!/usr/bin/env python
"""Diagnostic : que peut faire la Mongo de production, et où en est la migration ?

Repond a deux questions qu'on ne peut pas trancher depuis le reseau de developpement
(le port 27017 y est filtre) :

  1. La version du serveur supporte-t-elle $unionWith ? Le backend lit les bases
     « 1 collection par SN » en une commande par paquet quand c'est le cas, sinon
     il retombe sur une commande par serie. Le script ne compare pas un numero de
     version : il execute reellement l'etage, ce qui couvre aussi le cas ou il
     serait interdit par la configuration.

  2. La migration vers les collections unifiees a-t-elle eu lieu, et le backend
     va-t-il les utiliser ? Comparee au nombre de collections par SN, on voit
     immediatement si la reprise est complete.

Lecture seule — n'ecrit rien, ne cree rien.

Usage (sur le serveur, depuis iMPS_platform/backend) :
    python scripts/check_mongo_readiness.py

Lit MONGO_URI dans l'environnement, sinon dans le fichier .env a cote. Le mot de
passe n'est jamais affiche.
"""
import os
import pathlib
import re
import sys

from pymongo import MongoClient
from pymongo.errors import OperationFailure

# doit rester aligne sur _UNIFIED_NAMES (backend/routers/stations.py)
UNIFIED = {
    "edgeboxStatus": "status_by_sn",
    "settingParameter": "parameters_by_sn",
}


def read_uri() -> str:
    uri = os.getenv("MONGO_URI")
    if uri:
        return uri
    env = pathlib.Path(__file__).resolve().parent.parent / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.startswith("MONGO_URI="):
                return line.split("=", 1)[1].strip()
    print("MONGO_URI introuvable (ni variable d'environnement, ni .env).", file=sys.stderr)
    raise SystemExit(2)


def masked(uri: str) -> str:
    return re.sub(r"://[^@/]*@", "://***@", uri)


def union_with_works(client: MongoClient) -> tuple[bool, str]:
    """Execute reellement un $unionWith qui ne ramene rien — gratuit, et definitif.

    On filtre sur un champ inexistant plutot que d'utiliser {$limit: 0}, que Mongo
    refuse (« the limit must be positive ») : l'erreur porterait alors sur le $limit
    et ferait croire a tort que $unionWith n'est pas supporte.
    """
    db = client["admin"]
    never = {"$match": {"__probe_champ_inexistant__": True}}
    try:
        list(db["system.version"].aggregate([
            never,
            {"$unionWith": {"coll": "system.version", "pipeline": [never]}},
        ]))
        return True, ""
    except OperationFailure as e:
        return False, str(e).split("\n")[0][:160]
    except Exception as e:
        return False, f"{type(e).__name__}: {str(e)[:140]}"


def main() -> int:
    uri = read_uri()
    print(f"Cible : {masked(uri)}")
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=10000)
        info = client.server_info()
    except Exception as e:
        print(f"\nConnexion impossible : {type(e).__name__}: {str(e)[:200]}", file=sys.stderr)
        return 2

    version = info["version"]
    major, minor = (int(x) for x in version.split(".")[:2])
    print(f"Version MongoDB : {version}")

    ok, why = union_with_works(client)
    print(f"\n1) $unionWith utilisable : {'OUI' if ok else 'NON'}")
    if ok:
        print("   -> les endpoints bulk lisent par paquets de 120 collections")
    else:
        print(f"   -> {why}")
        print("   -> repli automatique : une commande par serie (correct, mais sans gain)")
        if (major, minor) < (4, 4):
            print("   -> $unionWith exige MongoDB >= 4.4 ; seule la migration")
            print("      (scripts/migrate_per_sn_collections.py) reduira le nombre de commandes")

    print("\n2) Etat de la migration vers les collections unifiees")
    for db_name, unified in UNIFIED.items():
        db = client[db_name]
        try:
            names = db.list_collection_names()
        except Exception as e:
            print(f"   {db_name:18} illisible : {str(e)[:100]}")
            continue
        per_sn = [n for n in names if n != unified and not n.startswith("system.")]
        if unified in names:
            coll = db[unified]
            docs = coll.estimated_document_count()
            try:
                series = len(coll.distinct("sn"))
            except Exception:
                series = "?"
            idx = "sn_1_timestamp_-1__id_-1" in coll.index_information()
            reste = (len(per_sn) - series) if isinstance(series, int) else "?"
            print(f"   {db_name:18} unifiee OUI — {docs} document(s), {series} serie(s), "
                  f"index lecture {'OK' if idx else 'ABSENT'}")
            print(f"   {'':18} collections par SN encore presentes : {len(per_sn)}"
                  + (f" (dont {reste} pas encore reprise(s))" if isinstance(reste, int) and reste > 0 else ""))
            if not idx:
                print(f"   {'':18} -> relancer migrate_per_sn_collections.py pour poser l'index")
        else:
            print(f"   {db_name:18} unifiee NON — {len(per_sn)} collection(s) par SN")
            print(f"   {'':18} -> migration pas faite ; le backend lit comme avant")

    print("\nNiveau de lecture effectif du backend :")
    done = all(UNIFIED[d] in client[d].list_collection_names() for d in UNIFIED)
    if done:
        print("   collection unifiee — 1 commande par endpoint")
    elif ok:
        print("   $unionWith — 1 commande par paquet de 120 series")
    else:
        print("   lecture unitaire — 1 commande par serie")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
