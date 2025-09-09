import React from "react";

import SearchDataTables from "./components/search-data-table";
import StatisticsCards from "./components/statistics-cards";
import { DocumentArrowDownIcon } from "@heroicons/react/24/solid";


export default function DataTablesPage() {
  return (
    <>
      {/* <a href="http://127.0.0.1:8000/download-pdf" className="tw-bg-blue-600 tw-text-white tw-px-4 tw-py-2 tw-rounded">
        Download PDF
      </a> */}



      <StatisticsCards />
      {/** Search DataTable */}
      <SearchDataTables />
    </>
  );
}
