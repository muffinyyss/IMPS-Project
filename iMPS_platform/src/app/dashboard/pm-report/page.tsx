import React from "react";

import SimpleDataTables from "./components/simple-data-table";
import SearchDataTables from "./components/search-data-table";
import StatisticsCards from "./components/statistics-cards";


export default function DataTablesPage() {
  return (
    <>
      <StatisticsCards />
      {/** Search DataTable */}
      <SearchDataTables />
    </>
  );
}
