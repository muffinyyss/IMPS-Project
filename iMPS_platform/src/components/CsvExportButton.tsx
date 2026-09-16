"use client";

/**
 * Bouton « exporter en CSV » des pages liste — icône tableur verte, placée après
 * « lignes par page ». Le parent fournit les lignes déjà filtrées/triées.
 */

import React from "react";

export default function CsvExportButton({ onClick, count, lang }: {
  onClick: () => void;
  /** nombre de lignes qui partiront dans le fichier (après filtres) */
  count: number;
  lang: "th" | "en";
}) {
  const label = lang === "th"
    ? `ส่งออก CSV (${count} รายการตามตัวกรอง)`
    : `Export CSV (${count} filtered record(s))`;
  const disabled = count === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="tw-inline-flex tw-h-9 tw-w-9 tw-items-center tw-justify-center tw-rounded-lg tw-border tw-border-green-200 tw-bg-white tw-shadow-sm tw-transition-colors hover:tw-border-green-400 hover:tw-bg-green-50 focus:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-green-400 disabled:tw-cursor-not-allowed disabled:tw-opacity-40"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="tw-h-6 tw-w-6">
        <path d="M6 1.5h8.5L20 7v14a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 5 21V3a1.5 1.5 0 0 1 1-1.5z" fill="#16a34a" />
        <path d="M14.5 1.5V7H20z" fill="#86efac" />
        <rect x="7.5" y="10.5" width="9" height="9" rx="0.6" fill="#fff" />
        <path d="M7.5 13.5h9M7.5 16.5h9M11 10.5v9" stroke="#16a34a" strokeWidth="1.1" />
      </svg>
    </button>
  );
}
