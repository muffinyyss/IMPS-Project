import React from "react";

import SearchDataTables from "./components/search-data-table";
import StatisticsCards from "./components/statistics-cards";
import { DocumentArrowDownIcon } from "@heroicons/react/24/solid";


export default function DataTablesPage() {
  return (
    <>
      {/* ปุ่มดาวน์โหลด PDF */}
      {/* <a
        href="http://127.0.0.1:8000/pdf/download"
        className="tw-inline-flex tw-items-center tw-bg-blue-600 tw-text-white tw-px-4 tw-py-2 tw-rounded hover:tw-bg-blue-700"
      >
        <DocumentArrowDownIcon className="tw-h-5 tw-w-5 tw-mr-2" />
        Download PDF
      </a> */}

      <StatisticsCards />
      {/** Search DataTable */}
      <SearchDataTables />
    </>
  );
}
