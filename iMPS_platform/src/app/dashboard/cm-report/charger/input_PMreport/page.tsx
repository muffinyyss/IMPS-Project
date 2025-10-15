"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, Typography } from "@material-tailwind/react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

// components
import CheckList from "./components/checkList";
// import PMReportPhotos from "./components/photoPM";

export default function PM_Report() {
  const router = useRouter();

  return (
    <section className="tw-mx-0 tw-px-3 md:tw-px-6 xl:tw-px-0 tw-pb-24">
      {/* Top bar actions */}
      <div className="tw-sticky tw-top-0 tw-z-20 tw-bg-transparent tw-pt-3 tw-pb-2">
        <div className="tw-flex tw-items-center tw-justify-between tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-2xl tw-shadow-sm tw-px-4 tw-py-3">
          <Button
            variant="text"
            onClick={() => router.back()}
            className="tw-bg-white tw-border tw-border-blue-gray-200 tw-rounded-xl tw-shadow-none tw-h-9 tw-px-4 tw-min-w-0 tw-flex tw-items-center tw-justify-center hover:tw-bg-blue-gray-50"
          >
            <ArrowLeftIcon className="tw-h-5 tw-w-5 tw-text-blue-gray-800" />
          </Button>
          <Typography variant="h5">รายงานบันทึกปัญหา (CM)</Typography>
          <div />
        </div>
      </div>

      {/* Company Info */}
      {/* <Card className="tw-mt-3 tw-shadow-sm tw-border tw-border-blue-gray-100">
        <CardBody className="tw-space-y-1">
          <Typography className="tw-font-semibold">
            บริษัท อีแกท ไดมอนด์ เซอร์วิส จำกัด (สำนักงานใหญ่) — Tax ID: 0125552017292
          </Typography>
          <Typography className="!tw-text-blue-gray-600">
            56/25 หมู่ 20 ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี 12120
          </Typography>
        </CardBody>
      </Card> */}

      {/* Content */}
      <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
        <CardBody className="tw-px-6">
          <CheckList
            onComplete={() => { }}
          />
          {/* <div className="tw-mt-6">
            <PMReportPhotos />
          </div> */}
        </CardBody>
      </Card>
    </section>
  );
}
