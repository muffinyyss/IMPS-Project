// "use client";
// import React, { useMemo, useState } from "react";
// import dynamic from "next/dynamic";

// // @material-tailwind/react
// import {
//     Card,
//     CardHeader,
//     CardBody,
//     Typography,
// } from "@/components/MaterialTailwind";

// // @heroicons/react
// import { GlobeAltIcon } from "@heroicons/react/24/outline";

// // components
// import DateRangePicker from "./components/date-range";
// import StatisticChart from "./components/statistics-chart";
// import BookingCards from "./components/booking-cards";
// import Table from "./components/table";
// import StatisticsCards from "./components/statistics-cards";

// // map
// const WorldMap = dynamic(() => import("./components/world-map"), {
//     ssr: false,
// });

// // helper: format YYYY-MM-DD
// function fmt(d: Date) {
//     const yyyy = d.getFullYear();
//     const mm = String(d.getMonth() + 1).padStart(2, "0");
//     const dd = String(d.getDate()).padStart(2, "0");
//     return `${yyyy}-${mm}-${dd}`;
// }

// export default function MDBPage() {

//     // default: ล่าสุด 30 วัน
//     const today = useMemo(() => new Date(), []);
//     const thirtyDaysAgo = useMemo(() => {
//         const d = new Date();
//         d.setDate(d.getDate() - 30);
//         return d;
//     }, []);

//     const [startDate, setStartDate] = useState<string>(fmt(thirtyDaysAgo));
//     const [endDate, setEndDate] = useState<string>(fmt(today));

//     // guard ง่าย ๆ: ถ้า end < start ให้ sync end = start
//     const handleStartChange = (v: string) => {
//         setStartDate(v);
//         if (endDate && v && new Date(v) > new Date(endDate)) {
//             setEndDate(v);
//         }
//     };
//     const handleEndChange = (v: string) => {
//         if (startDate && v && new Date(v) < new Date(startDate)) {
//             setStartDate(v);
//         }
//         setEndDate(v);
//     };

//     return (
//         <div className="tw-mt-8 tw-mb-4">
//             {/* Sale by Country */}
//             <Card className="tw-mb-6 tw-border tw-border-blue-gray-100 tw-shadow-sm">
//                 <div className="tw-flex tw-items-center">
//                     {/* <CardHeader
//             floated={false}
//             variant="gradient"
//             color="gray"
//             className="tw-grid tw-h-16 tw-w-16 tw-place-items-center"
//           >
//             <GlobeAltIcon className="tw-h-7 tw-w-7 tw-text-white" />
//           </CardHeader> */}
//                     {/* <Typography variant="h6" color="blue-gray" className="tw-mt-3">
//             Sales by Country
//           </Typography> */}
//                 </div>

//                 <CardBody className="tw-grid tw-grid-cols-1 tw-items-center tw-justify-between tw-p-4 lg:tw-grid-cols-2">
//                     <div className="tw-col-span-1 tw-overflow-scroll">
//                         <Table />
//                     </div>
//                     {/* <WorldMap /> */}
//                 </CardBody>
//             </Card>

//             {/* Statistics Charts */}
//             <StatisticChart/>


//             {/* Statistics Cards */}
//             <StatisticsCards />

//             {/* Booking Cards */}
//             <BookingCards />
//         </div>
//     );
// }


"use client";
import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";

// @material-tailwind/react
import {
    Card, CardBody, Typography,
} from "@/components/MaterialTailwind";

// components
import DateRangePicker from "./components/date-range";
import StatisticChart from "./components/statistics-chart";
import BookingCards from "./components/booking-cards";
import Table from "./components/table";
import StatisticsCards from "./components/statistics-cards";
import VoltageChart from "./components/area-chart";
import MDBInfo from "./components/mdb-info";


// map
const WorldMap = dynamic(() => import("./components/world-map"), { ssr: false });

// helper: format YYYY-MM-DD
function fmt(d: Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

export default function MDBPage() {
    // default: ล่าสุด 30 วัน
    const today = useMemo(() => new Date(), []);
    const thirtyDaysAgo = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d;
    }, []);

    const [startDate, setStartDate] = useState<string>(fmt(thirtyDaysAgo));
    const [endDate, setEndDate] = useState<string>(fmt(today));

    // guard: รักษาลอจิก start <= end
    const handleStartChange = (v: string) => {
        setStartDate(v);
        if (endDate && v && new Date(v) > new Date(endDate)) setEndDate(v);
    };
    const handleEndChange = (v: string) => {
        if (startDate && v && new Date(v) < new Date(startDate)) setStartDate(v);
        setEndDate(v);
    };

    return (
        <div className="tw-mt-8 tw-mb-4">

            {/* Statistics Cards */}
            <StatisticsCards
                tempC={55}
                humidity={87}
                fanOn={true}
                rssiDb={-54}
                signalLevel={4}
            />


            {/* Panel ข้อมูล MDB เต็มกว้าง */}
            <Card className="tw-mb-6 tw-border tw-border-blue-gray-100 tw-shadow-sm">
                <CardBody className="tw-p-4 md:tw-p-6">
                    <MDBInfo
                        tempC={55}
                        humidity={87}
                        fanOn={true}
                        rssiDb={-54}
                        signalLevel={4}
                        totalCurrentA={2.11}
                        powerKW={0.283}
                        totalEnergyKWh={"305049.248"}
                        frequencyHz={"50.04"}
                        pfL1={0.49}
                        pfL2={0.98}
                        pfL3={0}
                        thduL1={2.3}
                        thduL2={2.14}
                        thduL3={2.17}
                        thdiL1={55.28}
                        thdiL2={112.62}
                        thdiL3={100}
                    />
                </CardBody>
            </Card>

            {/* ===== Date range ก่อนกราฟทั้งสาม ===== */}
            <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartChange={handleStartChange}
                onEndChange={handleEndChange}
            />

            {/* ===== Statistics Charts (รับช่วงวันที่ไปใช้ได้) ===== */}
            {/* ถ้าคอมโพเนนต์กราฟของคุณรองรับ ให้ส่ง props ไปเลย */}
            <StatisticChart startDate={startDate} endDate={endDate} />

            {/* Booking Cards */}
            {/* <BookingCards /> */}
        </div>
    );
}
