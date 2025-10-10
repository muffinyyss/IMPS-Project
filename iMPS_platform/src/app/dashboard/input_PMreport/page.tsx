"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Typography,
} from "@material-tailwind/react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

// components
import CheckList from "./components/checkList";
import PMReportPhotos from "./components/photoPM";

export default function PM_Report() {
  const router = useRouter();
  const [page, setPage] = useState<0 | 1>(0);
  const [isCheckListComplete, setIsCheckListComplete] = useState(false);

  const goTo = (target: 0 | 1) => {
    if (target === 1 && !isCheckListComplete) {
      alert("กรุณากรอกและตอบ PASS/FAIL ให้ครบก่อน จึงจะไปหน้า 2 ได้");
      return;
    }
    setPage(target);
  };

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
        {/* <CardHeader floated={false} shadow={false} className="tw-px-6 tw-pt-6 tw-pb-2">
          <div className="tw-flex tw-items-center tw-gap-2">
            <Button
              variant={page === 0 ? "filled" : "outlined"}
              size="sm"
              onClick={() => goTo(0)}
              className={`tw-rounded-full tw-min-w-[2.25rem] tw-h-9 ${page === 0 ? "tw-bg-blue-600" : "tw-bg-white"}`}
            >1</Button>

            <Button
              variant={page === 1 ? "filled" : "outlined"}
              size="sm"
              onClick={() => goTo(1)}
              disabled={!isCheckListComplete}
              title={!isCheckListComplete ? "ต้องกรอกให้ครบและตอบ PASS/FAIL ให้ครบก่อน" : "ไปหน้า 2"}
              className={`tw-rounded-full tw-min-w-[2.25rem] tw-h-9 ${page === 1 ? "tw-bg-blue-600" : "tw-bg-white"} ${!isCheckListComplete ? "tw-opacity-60 tw-cursor-not-allowed" : ""}`}
            >2</Button>

            <Typography className="tw-ml-3 tw-text-blue-gray-700">
              {`Page ${page + 1} / 2`}
            </Typography>
          </div>
        </CardHeader> */}

        <CardBody className="tw-px-6 tw-pb-0">
          {/* Page 1 */}
          <div className={page === 0 ? "" : "tw-hidden"} aria-hidden={page !== 0}>
            <CheckList
              onComplete={(status: boolean) => setIsCheckListComplete(status)}
              onNext={() => goTo(1)}   // ✅ ให้ CheckList เรียกอันนี้เท่านั้นเมื่อกด "ถัดไป"
              onPrev={() => goTo(0)}
            />
          </div>

          {/* Page 2 */}
          <div className={page === 1 ? "" : "tw-hidden"}  aria-hidden={page !== 1}>
            {/* ส่ง callback เพื่อสลับกลับหน้า 1 */}
            <PMReportPhotos onBack={() => goTo(0)} />
          </div>
        </CardBody>
      </Card>
    </section>
  );
}

