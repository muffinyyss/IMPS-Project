import React from "react";
import SearchDataTables from "./components/search-data-table"; // ถ้าต้องใช้
import StatisticsCards from "./components/statistics-cards";

export default function DataTablesPage() {
  return (
    <>
      <StatisticsCards />
      <SearchDataTables /> {/* ถ้า dropdown ย้ายไป Navbar แล้ว จะคง/ลบก็ได้ */}
    </>
  );
}