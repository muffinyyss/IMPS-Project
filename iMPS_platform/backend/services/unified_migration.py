"""Bascule « 1 collection par SN » → « 1 collection + champ sn », en continu.

Pourquoi
--------
`edgeboxStatus` et `settingParameter` gardent une collection par numéro de série.
Lire le dernier document de N séries coûtait N commandes Mongo, rejouées toutes
les 10 s par chaque onglet Stations ouvert. Une collection unique portant le SN
en champ ramène la lecture à une seule commande, quel que soit le parc.

Automatique
-----------
Ce module est appelé au démarrage du backend (`main.py`) puis périodiquement :
la bascule se fait donc toute seule au premier lancement après le merge, sur dev
comme en prod, sans commande à lancer à la main. `scripts/migrate_per_sn_collections.py`
reste disponible pour la forcer ou l'observer, mais n'est plus nécessaire.

Correction et sûreté
--------------------
* **`_src`** : chaque document copié garde l'`_id` de son document d'origine.
  C'est la clé d'unicité (idempotence parfaite, quel que soit le nombre de
  relances) *et* la clé de tri. Sans lui il faudrait se fier à l'ordre
  d'insertion : la première version de ce code copiait du plus récent au plus
  ancien, si bien qu'un tri par `_id` sur la collection unifiée renvoyait le
  document le **plus ancien** de la série. Le pipeline renseigne `_src` lui aussi
  (voir `MongoDBClient.insert_unified`), donc ses écritures et celles de la
  reprise se trient ensemble.
* **fraîcheur** : le pipeline alimente la collection unifiée en parallèle de la
  collection par SN. S'il n'est pas encore déployé — ou s'il s'arrête — la
  collection unifiée cesse d'être alimentée et les statuts affichés gèleraient.
  `is_fresh()` le détecte en une commande, et la tâche de fond resynchronise
  tant que c'est nécessaire. L'ordre de déploiement n'a donc pas à être maîtrisé.
* **jamais destructif** : les collections par SN ne sont pas touchées. Elles
  peuvent être supprimées plus tard, une fois la lecture unifiée confirmée.
* **désactivable** : `UNIFIED_MIGRATION=off` dans l'environnement coupe tout.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from pymongo.errors import BulkWriteError

logger = logging.getLogger("unified_migration")

# base source -> collection unifiée
UNIFIED_NAMES: Dict[str, str] = {
    "edgeboxStatus": "status_by_sn",
    "settingParameter": "parameters_by_sn",
}

# tri utilisé par le backend pour lire chaque base (côté collections par SN)
SOURCE_SORT: Dict[str, Dict[str, int]] = {
    "edgeboxStatus": {"timestamp": -1, "_id": -1},
    "settingParameter": {"_id": -1},
}

# au-delà, on considère que plus personne n'alimente la collection unifiée
STALE_AFTER = timedelta(minutes=20)

# documents repris par série au tout premier passage
DEFAULT_LIMIT_PER_SN = 1000

_BATCH = 1000


def enabled() -> bool:
    return os.getenv("UNIFIED_MIGRATION", "on").strip().lower() not in {"off", "0", "false", "no"}


def unified_sort(sort: Dict[str, int]) -> Dict[str, int]:
    """Traduit un tri des collections par SN vers la collection unifiée.

    Dans la collection unifiée, `_id` est celui de la copie — sans rapport avec
    l'ordre d'origine. C'est `_src` qui porte l'`_id` du document source.
    """
    return {("_src" if key == "_id" else key): direction for key, direction in sort.items()}


def read_index(db_name: str):
    """Index qui sert exactement le tri de lecture, série par série."""
    return [("sn", 1)] + list(unified_sort(SOURCE_SORT[db_name]).items())


def ensure_indexes(target, db_name: str) -> None:
    # unicité de la source : rend la reprise rejouable sans jamais dupliquer
    target.create_index([("_src", 1)], unique=True, sparse=True, name="_src_1")
    target.create_index(read_index(db_name), name="sn_read")


def is_fresh(client, db_name: str, now: Optional[datetime] = None) -> Optional[bool]:
    """La collection unifiée est-elle encore alimentée ? None si elle n'existe pas.

    Une seule commande : le document le plus récent, via l'index sur `_id`.
    L'horodatage d'un ObjectId est celui de son écriture — c'est exactement la
    question posée (quand cette collection a-t-elle été écrite pour la dernière
    fois ?), indépendamment du champ `timestamp` métier.
    """
    name = UNIFIED_NAMES.get(db_name)
    if name is None:
        return None
    db = client[db_name]
    try:
        if name not in db.list_collection_names(filter={"name": name}):
            return None
        newest = db[name].find_one({}, {"_id": 1}, sort=[("_id", -1)])
    except Exception as e:
        logger.warning("%s: lecture de fraîcheur impossible (%s)", db_name, e)
        return None
    if not newest:
        return False
    age = (now or datetime.now(timezone.utc)) - newest["_id"].generation_time
    return age < STALE_AFTER


def sync_database(client, db_name: str, limit_per_sn: int = DEFAULT_LIMIT_PER_SN,
                  progress=None) -> Dict[str, int]:
    """Met la collection unifiée à jour depuis les collections par SN.

    Premier passage : reprend les `limit_per_sn` documents les plus récents de
    chaque série. Ensuite : uniquement ce qui est arrivé depuis, grâce à `_src`.
    """
    unified_name = UNIFIED_NAMES[db_name]
    db = client[db_name]
    target = db[unified_name]
    ensure_indexes(target, db_name)

    stats = {"series": 0, "lus": 0, "ecrits": 0, "ignores": 0}

    sources = [
        n for n in db.list_collection_names()
        if n != unified_name and not n.startswith("system.")
    ]
    stats["series"] = len(sources)
    if not sources:
        return stats

    # ce qui est déjà repris, par série — une commande, servie par l'index sn_read
    done: Dict[str, Any] = {}
    try:
        for row in target.aggregate([{"$group": {"_id": "$sn", "src": {"$max": "$_src"}}}]):
            if row.get("_id") is not None and row.get("src") is not None:
                done[row["_id"]] = row["src"]
    except Exception as e:
        logger.warning("%s: état de reprise illisible (%s) — reprise complète", db_name, e)

    pending: list = []

    def flush() -> None:
        if not pending:
            return
        try:
            res = target.insert_many(pending, ordered=False)
            stats["ecrits"] += len(res.inserted_ids)
        except BulkWriteError as e:
            details = e.details or {}
            errors = details.get("writeErrors", [])
            stats["ecrits"] += details.get("nInserted", 0)
            stats["ignores"] += sum(1 for err in errors if err.get("code") == 11000)
            autres = [err for err in errors if err.get("code") != 11000]
            if autres:
                logger.warning("%s: %d erreur(s) d'écriture, ex. %s",
                               db_name, len(autres), str(autres[0].get("errmsg", ""))[:150])
        except Exception as e:
            logger.warning("%s: écriture échouée (%s)", db_name, e)
        pending.clear()

    for i, sn in enumerate(sources, 1):
        since = done.get(sn)
        try:
            if since is None:
                # jamais repris : les plus récents d'abord, puis remis dans l'ordre
                # chronologique — l'ordre d'insertion n'a pas d'importance puisque
                # le tri se fait sur `_src`, mais il reste plus lisible en base
                docs = list(db[sn].find({}).sort([("_id", -1)]).limit(limit_per_sn))
                docs.reverse()
            else:
                docs = list(db[sn].find({"_id": {"$gt": since}})
                            .sort([("_id", 1)]).limit(limit_per_sn))
        except Exception as e:
            logger.warning("%s.%s illisible (%s)", db_name, sn, e)
            continue

        for doc in docs:
            stats["lus"] += 1
            src = doc.pop("_id")
            doc["sn"] = sn
            doc["_src"] = src
            pending.append(doc)
            if len(pending) >= _BATCH:
                flush()
        if progress and (i % 100 == 0 or i == len(sources)):
            flush()
            progress(i, len(sources), stats)
    flush()
    return stats


def sync_all(client, limit_per_sn: int = DEFAULT_LIMIT_PER_SN,
             only_if_stale: bool = False, progress=None) -> Dict[str, Dict[str, int]]:
    """Synchronise les deux bases. `only_if_stale` saute celles que le pipeline
    alimente déjà — c'est le cas normal une fois tout déployé, et ça ne coûte
    alors qu'une commande par base."""
    out: Dict[str, Dict[str, int]] = {}
    for db_name in UNIFIED_NAMES:
        if only_if_stale and is_fresh(client, db_name):
            out[db_name] = {"series": 0, "lus": 0, "ecrits": 0, "ignores": 0, "saute": 1}
            continue
        try:
            out[db_name] = sync_database(client, db_name, limit_per_sn, progress)
        except Exception as e:
            logger.warning("%s: synchronisation échouée (%s)", db_name, e)
            out[db_name] = {"series": 0, "lus": 0, "ecrits": 0, "ignores": 0, "erreur": str(e)[:200]}
    return out
