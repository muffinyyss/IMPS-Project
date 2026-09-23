#!/usr/bin/env python
"""Force ou observe la bascule « 1 collection par SN » -> « 1 collection + champ sn ».

La bascule est **automatique** : le backend la lance a son demarrage puis
l'entretient en tache de fond (services/unified_migration.py). Ce script n'est
donc pas necessaire au deploiement — il sert a la declencher tout de suite sans
attendre un redemarrage, a la simuler avant de la lancer, ou a en suivre le
deroulement dans un terminal.

Il n'y a aucune coordination a prevoir : le backend detecte lui-meme si la
collection unifiee est encore alimentee et resynchronise sinon, donc l'ordre de
deploiement du backend et du pipeline n'a pas d'importance.

Les collections par SN ne sont jamais touchees.

Usage :
    python scripts/migrate_per_sn_collections.py --dry-run
    python scripts/migrate_per_sn_collections.py
    python scripts/migrate_per_sn_collections.py --db edgeboxStatus --limit-per-sn 500
"""
import argparse
import os
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from pymongo import MongoClient

from services.unified_migration import (  # noqa: E402
    DEFAULT_LIMIT_PER_SN,
    UNIFIED_NAMES,
    is_fresh,
    sync_database,
)


def read_uri() -> str:
    uri = os.getenv("MONGO_URI")
    if uri:
        return uri
    env = pathlib.Path(__file__).resolve().parent.parent / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.startswith("MONGO_URI="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    print("MONGO_URI introuvable (ni variable d'environnement, ni .env).", file=sys.stderr)
    raise SystemExit(2)


def masked(uri: str) -> str:
    return re.sub(r"://[^@/]*@", "://***@", uri)


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", choices=sorted(UNIFIED_NAMES), help="ne traiter que cette base")
    ap.add_argument("--limit-per-sn", type=int, default=DEFAULT_LIMIT_PER_SN,
                    help=f"documents repris par serie au 1er passage (defaut : {DEFAULT_LIMIT_PER_SN})")
    ap.add_argument("--dry-run", action="store_true", help="n'ecrit rien, montre l'etat")
    args = ap.parse_args()

    uri = read_uri()
    print(f"Cible : {masked(uri)}")
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=10000)
        print(f"MongoDB {client.server_info()['version']}")
    except Exception as e:
        print(f"Connexion impossible : {e}", file=sys.stderr)
        return 2

    bases = [args.db] if args.db else list(UNIFIED_NAMES)
    total = {"series": 0, "lus": 0, "ecrits": 0, "ignores": 0}

    for db_name in bases:
        unified_name = UNIFIED_NAMES[db_name]
        db = client[db_name]
        sources = [n for n in db.list_collection_names()
                   if n != unified_name and not n.startswith("system.")]
        fresh = is_fresh(client, db_name)
        etat = {None: "absente", True: "alimentee", False: "en retard"}[fresh]
        print(f"\n=== {db_name} -> {unified_name} : {len(sources)} serie(s), collection unifiee {etat} ===")

        if args.dry_run:
            deja = db[unified_name].estimated_document_count() if fresh is not None else 0
            print(f"    {deja} document(s) deja repris — simulation, rien n'est ecrit")
            continue

        def progress(i, n, st):
            print(f"    {i}/{n} series — {st['ecrits']} copie(s), {st['ignores']} deja presente(s)")

        st = sync_database(client, db_name, args.limit_per_sn, progress)
        for k in total:
            total[k] += st[k]

    if not args.dry_run:
        print(f"\nTotal : {total['series']} serie(s), {total['lus']} lu(s), "
              f"{total['ecrits']} copie(s), {total['ignores']} deja presente(s)")
        print("Les collections par SN n'ont pas ete touchees — a supprimer seulement")
        print("apres confirmation de la lecture unifiee en production.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
