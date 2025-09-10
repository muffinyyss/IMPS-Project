"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Typography,
} from "@material-tailwind/react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

// component
import CheckList from "./components/checkList";
import PMReportPhotos from "./components/photoPM";

export default function PM_Report() {
  const router = useRouter();
  const [page, setPage] = useState(0); // 0 = CheckList, 1 = PMReportPhotos
  const [isCheckListComplete, setIsCheckListComplete] = useState(false); // state เพื่อเก็บสถานะว่า checkList เสร็จหรือไม่

  // รวมคอมโพเนนต์ไว้ใน array
  const pages = [
    // <CheckList key="checklist" onComplete={(status) => setIsCheckListComplete(status)} />,
    <CheckList/>,
    <PMReportPhotos key="photos" />,
  ];

  const goPrev = () => setPage((p) => Math.max(0, p - 1));
  const goNext = () => setPage((p) => Math.min(pages.length - 1, p + 1));

  const isFirst = page === 0;
  const isLast = page === pages.length - 1;

  return (
    <section className="tw-mx-0 tw-px-3 md:tw-px-6 xl:tw-px-0 tw-pb-24">
      {/* Top bar actions */}
      <div className="tw-sticky tw-top-0 tw-z-20 tw-bg-transparent tw-pt-3 tw-pb-2">
        <div
          className="
            tw-flex tw-items-center tw-justify-between
            tw-bg-white tw-border tw-border-blue-gray-100
            tw-rounded-2xl tw-shadow-sm
            tw-px-4 tw-py-3
        "
        >
          <Button
            variant="text"
            onClick={() => router.back()}
            className="tw-bg-white tw-border tw-border-blue-gray-200 tw-rounded-xl tw-shadow-none tw-h-9 tw-px-4 tw-min-w-0 tw-flex tw-items-center tw-justify-center hover:tw-bg-blue-gray-50"
          >
            <ArrowLeftIcon className="tw-h-5 tw-w-5 tw-text-blue-gray-800" />
          </Button>

          <Typography variant="h5">Preventive Maintenance Report (PM)</Typography>
          <div />
        </div>
      </div>

      {/* Company Info */}
      <Card className="tw-mt-3 tw-shadow-sm tw-border tw-border-blue-gray-100">
        <CardBody className="tw-space-y-1">
          <Typography className="tw-font-semibold">
            บริษัท อีแกท ไดมอนด์ เซอร์วิส จำกัด (สำนักงานใหญ่) — Tax ID: 0125552017292
          </Typography>
          <Typography className="!tw-text-blue-gray-600">
            56/25 หมู่ 20 ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี 12120
          </Typography>
        </CardBody>
      </Card>

      {/* ===== Pagination Section ===== */}
      <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
        <CardHeader floated={false} shadow={false} className="tw-px-6 tw-pt-6 tw-pb-2 tw-bg-transparent">
          <div className="tw-flex tw-items-center tw-gap-2">
            {[0, 1].map((i) => (
              <Button
                key={i}
                variant={page === i ? "filled" : "outlined"}
                size="sm"
                onClick={() => setPage(i)}
                className={`
                  tw-rounded-full tw-min-w-[2.25rem] tw-h-9
                  ${page === i ? "tw-bg-blue-600" : "tw-bg-white"}
                `}
              >
                {i + 1}
              </Button>
            ))}

            <Typography className="tw-ml-3 tw-text-blue-gray-700">
              {`Page ${page + 1} / ${pages.length}`}
            </Typography>
          </div>
        </CardHeader>

        <CardBody className="tw-px-6 tw-pb-0">
          {/* render คอมโพเนนต์ตาม page */}
          {pages[page]}
        </CardBody>

        <CardFooter className="tw-px-6 tw-pt-4 tw-pb-6 tw-flex tw-justify-between">
          <Button variant="outlined" onClick={goPrev} disabled={isFirst}>
            Previous
          </Button>
          <Button color="blue-gray" onClick={goNext} disabled={isLast}>
            Next
          </Button>
        </CardFooter>
      </Card>
    </section>
  );
}
