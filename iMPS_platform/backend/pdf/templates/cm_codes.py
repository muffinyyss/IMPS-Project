"""Resolve CM labels from the Maximo IN04 failure-code tree.

The PDF renderer is synchronous, so the PDF route fetches the current IN04
tree and injects it into the document under ``_maximo_failure_codes`` before
calling the renderer.  No failure-code descriptions are stored in this
module; unknown values are returned as their original codes.
"""

from __future__ import annotations

from typing import Any, Iterable


def _norm(value: Any) -> str:
    return str(value or "").strip().upper()


def _tree_classes(failure_codes: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not isinstance(failure_codes, dict):
        return []
    classes = failure_codes.get("classes")
    return [item for item in classes if isinstance(item, dict)] if isinstance(classes, list) else []


def _find_class(
    failure_codes: dict[str, Any] | None,
    code: Any,
    alternate_code: Any = None,
) -> dict[str, Any] | None:
    wanted = {_norm(code), _norm(alternate_code)} - {""}
    if not wanted:
        return None
    for item in _tree_classes(failure_codes):
        if _norm(item.get("code")) in wanted:
            return item
    return None


def _items(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, list):
        return (item for item in value if isinstance(item, dict))
    return ()


def _first_label(items: Iterable[dict[str, Any]], code: Any) -> str:
    wanted = _norm(code)
    if not wanted:
        return ""
    for item in items:
        if _norm(item.get("code")) == wanted:
            label = str(item.get("description") or "").strip()
            if label:
                return label
    return ""


def _problem_nodes(
    failure_codes: dict[str, Any] | None,
    failure_class_code: Any = None,
) -> list[dict[str, Any]]:
    selected = _find_class(failure_codes, failure_class_code)
    classes = [selected] if selected else _tree_classes(failure_codes)
    return [problem for cls in classes for problem in _items(cls.get("problems"))]


def failure_code_label(
    code: Any,
    failure_codes: dict[str, Any] | None = None,
    failure_class_code: Any = None,
) -> str:
    selected = _find_class(failure_codes, failure_class_code, code)
    if selected:
        return str(selected.get("description") or "").strip() or str(code or "").strip()
    # Let the caller use a stored equipment label (for example charger_1)
    # when the value is not a Maximo failure class.
    return "" if failure_codes is not None else str(code or "").strip()


def problem_label(
    code: Any,
    failure_codes: dict[str, Any] | None = None,
    failure_class_code: Any = None,
) -> str:
    label = _first_label(
        _problem_nodes(failure_codes, failure_class_code),
        code,
    )
    return label or str(code or "").strip()


def cause_label(
    code: Any,
    failure_codes: dict[str, Any] | None = None,
    failure_class_code: Any = None,
) -> str:
    causes = (
        cause
        for problem in _problem_nodes(failure_codes, failure_class_code)
        for cause in _items(problem.get("causes"))
    )
    label = _first_label(causes, code)
    return label or str(code or "").strip()


def _remedy_matches(
    failure_codes: dict[str, Any] | None,
    failure_class_code: Any,
    problem_codes: set[str],
    cause_codes: set[str],
    remedy_code: str,
) -> list[str]:
    descriptions: list[str] = []
    for problem in _problem_nodes(failure_codes, failure_class_code):
        if problem_codes and _norm(problem.get("code")) not in problem_codes:
            continue
        for cause in _items(problem.get("causes")):
            if cause_codes and _norm(cause.get("code")) not in cause_codes:
                continue
            for remedy in _items(cause.get("remedies")):
                if _norm(remedy.get("code")) != remedy_code:
                    continue
                description = str(remedy.get("description") or "").strip()
                if description and description not in descriptions:
                    descriptions.append(description)
    return descriptions


def remedy_descriptions(
    failure_code: Any,
    problems: Iterable[Any],
    causes: Iterable[Any],
    remedy: Any,
    failure_codes: dict[str, Any] | None = None,
    failure_class_code: Any = None,
) -> list[str]:
    """Return the current Maximo remedy description for the selected context."""
    remedy_code = _norm(remedy)
    if not remedy_code:
        return []

    problem_codes = {_norm(value) for value in problems or [] if _norm(value)}
    cause_codes = {_norm(value) for value in causes or [] if _norm(value)}
    descriptions = _remedy_matches(
        failure_codes,
        failure_class_code or failure_code,
        problem_codes,
        cause_codes,
        remedy_code,
    )
    if descriptions:
        return descriptions

    # If the stored report has incomplete context, still use Maximo's label
    # for this remedy code rather than inventing a PDF description.
    descriptions = _remedy_matches(
        failure_codes,
        failure_class_code or failure_code,
        set(),
        set(),
        remedy_code,
    )
    return descriptions or [str(remedy or "").strip()]
