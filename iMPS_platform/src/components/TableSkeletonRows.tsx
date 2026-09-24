"use client";
import React from "react";

/**
 * แถวโครงร่างระหว่างโหลดตาราง
 *
 * จำนวนแถวต้องเท่ากับขนาดหน้าจริง (table.getState().pagination.pageSize)
 * ไม่งั้นตารางจะเปลี่ยนความสูงตอนข้อมูลมาถึง แล้วดันทุกอย่างข้างล่างลง — วัดได้เป็น
 * layout shift 0.13 บนหน้า Stations ก่อนแก้ (เกณฑ์ที่ยอมรับได้คือ 0.1)
 *
 * `rowHeight` : hauteur imposée à chaque ligne, en unité CSS (ex. "var(--table-row-h)").
 * Sans elle, une ligne de squelette mesure ~49 px alors qu'une ligne de données en
 * mesure ~57 px : le corps du tableau change quand même de hauteur à l'arrivée des
 * données. Les deux doivent être égales pour que la réserve tienne.
 */
export default function TableSkeletonRows({
  rows,
  cols,
  rowHeight,
}: {
  rows: number;
  cols: number;
  rowHeight?: string;
}) {
  return (
    <>
      {Array.from({ length: Math.max(1, rows) }).map((_, r) => (
        <tr key={r} className="tw-animate-pulse" style={rowHeight ? { height: rowHeight } : undefined}>
          {Array.from({ length: Math.max(1, cols) }).map((_, c) => (
            <td key={c} className="tw-px-3 tw-py-4">
              <div
                className="tw-h-4 tw-rounded-md tw-bg-blue-gray-100/60"
                // ความกว้างคงที่ตามตำแหน่ง — Math.random() ตอน render จะเปลี่ยนทุกครั้งที่ re-render
                style={{ width: c === 0 ? 32 : `${55 + ((r * 7 + c * 13) % 35)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/**
 * Réserve la place des lignes manquantes sous un tableau paginé.
 *
 * Une page de 10 lignes qui n'en ramène que 4 fait remonter le pied de tableau :
 * mesuré sur /dashboard/cm-report, le corps passe de 490 px (10 lignes de squelette)
 * à 228 px (4 lignes de données), soit un décalage de 0,114 — à lui seul au-dessus
 * du seuil acceptable de 0,1. Ce bloc complète la hauteur jusqu'à une page pleine,
 * donc le pied de tableau ne bouge plus, que le résultat tienne 0, 4 ou 10 lignes.
 *
 * Il se place après `</table>`, dans le conteneur qui l'enveloppe — pas dans le
 * `<tbody>`, pour ne pas perturber le modèle de tableau ni la numérotation des lignes.
 */
export function TableBodySpacer({
  pageSize,
  shown,
  rowHeight = "var(--table-row-h)",
}: {
  pageSize: number;
  shown: number;
  rowHeight?: string;
}) {
  const missing = Math.max(0, pageSize - shown);
  if (missing === 0) return null;
  return <div aria-hidden style={{ height: `calc(${missing} * ${rowHeight})` }} />;
}
