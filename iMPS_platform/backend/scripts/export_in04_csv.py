"""Export the current Maximo IN04 failure-code hierarchy to CSV.

The CSV is flattened to one row per leaf path:
Failure Class -> Problem -> Cause -> Remedy.
Incomplete paths are retained with empty values for missing levels.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import sys
from pathlib import Path
from typing import Any


BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND / ".env")

from services import maximo  # noqa: E402


CSV_COLUMNS = [
    "failure_class_code",
    "failure_class_description",
    "problem_code",
    "problem_description",
    "cause_code",
    "cause_description",
    "remedy_code",
    "remedy_description",
]


def _code_and_description(node: dict[str, Any]) -> tuple[str, str]:
    value = node.get("failurecode")
    if isinstance(value, list) and value:
        first = value[0] if isinstance(value[0], dict) else {}
        return (
            str(first.get("failurecode") or "").strip(),
            str(first.get("description") or "").strip(),
        )
    return (
        str(value or "").strip(),
        str(node.get("flcdescription") or node.get("description") or "").strip(),
    )


def flatten_failure_nodes(nodes: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Flatten Maximo's parent-linked failure nodes with descriptions."""
    children: dict[Any, list[dict[str, Any]]] = {}
    for node in nodes:
        children.setdefault(node.get("parent"), []).append(node)

    rows: list[dict[str, str]] = []

    def add_row(
        failure: tuple[str, str],
        problem: tuple[str, str] = ("", ""),
        cause: tuple[str, str] = ("", ""),
        remedy: tuple[str, str] = ("", ""),
    ) -> None:
        rows.append(
            {
                "failure_class_code": failure[0],
                "failure_class_description": failure[1],
                "problem_code": problem[0],
                "problem_description": problem[1],
                "cause_code": cause[0],
                "cause_description": cause[1],
                "remedy_code": remedy[0],
                "remedy_description": remedy[1],
            }
        )

    for failure_node in children.get(None, []):
        failure = _code_and_description(failure_node)
        if not failure[0]:
            continue
        problem_nodes = children.get(failure_node.get("failurelist"), [])
        if not problem_nodes:
            add_row(failure)
            continue

        for problem_node in problem_nodes:
            problem = _code_and_description(problem_node)
            cause_nodes = children.get(problem_node.get("failurelist"), [])
            if not cause_nodes:
                add_row(failure, problem)
                continue

            for cause_node in cause_nodes:
                cause = _code_and_description(cause_node)
                remedy_nodes = children.get(cause_node.get("failurelist"), [])
                if not remedy_nodes:
                    add_row(failure, problem, cause)
                    continue

                for remedy_node in remedy_nodes:
                    remedy = _code_and_description(remedy_node)
                    if remedy[0]:
                        add_row(failure, problem, cause, remedy)

    return rows


async def export(output: Path) -> tuple[int, int]:
    nodes = await maximo.query_failure_list()
    rows = flatten_failure_nodes(nodes)
    if not rows:
        raise RuntimeError("Maximo returned no exportable IN04 failure-code paths")

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    return len(nodes), len(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Destination CSV path")
    args = parser.parse_args()

    try:
        node_count, row_count = asyncio.run(export(args.output))
    except Exception as exc:
        print(f"IN04 export failed: {exc}", file=sys.stderr)
        return 1

    print(f"IN04 export completed: {node_count} Maximo nodes -> {row_count} CSV rows")
    print(f"Output: {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
