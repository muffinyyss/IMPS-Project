"use client";

import React, { useState } from "react";
import { DocumentArrowDownIcon } from "@heroicons/react/24/outline";

import {
    getCoreRowModel,
    getPaginationRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
    flexRender,
    type ColumnDef,
    type CellContext,
    type Row,
    type SortingState,
} from "@tanstack/react-table";

import { AppDataTable } from "@/data";

import {
    Button,
    Card,
    CardBody,
    CardHeader,
    Typography,
    CardFooter,
    Input,
} from "@material-tailwind/react";

import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronUpDownIcon,
} from "@heroicons/react/24/solid";
import Link from "next/link";


// ใช้ type ของข้อมูลแถวจาก AppDataTable โดยตรง
type TData = (typeof AppDataTable)[number];

export function SearchDataTables() {

    return (
        <>
            <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-8 tw-scroll-mt-4">
                <CardHeader
                    floated={false}
                    shadow={false}
                    className="tw-p-2 tw-flex tw-items-center tw-justify-between">
                    <div>
                        <Typography color="blue-gray" variant="h5">
                            PM Report
                        </Typography>
                        <Typography
                            variant="small"
                            className="!tw-text-blue-gray-500 !tw-font-normal tw-mb-4 tw-mt-1"
                        >
                            ค้นหาและดาวน์โหลดเอกสารรายงานการบำรุงรักษา (PM Report)
                        </Typography>
                    </div>

                    <Link href="input_PMreport">
                        <Button className="tw-flex tw-gap-2" variant="gradient" size="lg">
                            save
                        </Button>
                    </Link>

                </CardHeader>

                <CardBody className="tw-flex tw-items-center tw-px-4 tw-justify-between">
                    <div className="tw-mb-4 tw-mt-8 tw-flex tw-w-full tw-flex-col md:tw-flex-row">
                        {/* Left Column: Question */}
                        <div className="tw-w-full md:tw-w-1/2 tw-flex tw-items-center tw-justify-end tw-mr-4">
                            <span className="tw-text-lg tw-font-small tw-text-gray-700">Incoming cable Insulation Test/การทดสอบความเป็นฉนวนของสาย Incoming ที่แรงดัน500Vต้องได้ไม่น้อยกว่า100MΩ(ก่อนPM)</span>
                        </div>

                        {/* Right Column: Input */}
                        <div className="tw-w-full md:tw-w-1/2">
                            <Input label="Name" />
                        </div>
                    </div>
                </CardBody>

            </Card>
        </>
    );
}


export default SearchDataTables;
