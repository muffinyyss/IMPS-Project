"use client";

import React, { useEffect, useState } from "react";
import {
  Typography,
  Card,
  CardHeader,
  CardBody,
  Button,
} from "@/components/MaterialTailwind";
import {
  useRouter,
  useSearchParams,
  useParams,
} from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type ModuleConfig = {
  id: string;
  title: string;
  description: string;
  inputCollection: string;
  outputCollection: string;
};

const MODULE_CONFIG: Record<string, ModuleConfig> = {
  module1: {
    id: "module1",
    title: "MDB Dust Filters Prediction",
    description:
      "โมเดลคำนวณอายุกรองฝุ่นของ MDB จากอุณหภูมิ ความชื้น ความดัน และอายุการใช้งานของไส้กรอง เพื่อประเมิน RUL และ Health Index",
    inputCollection: "module1MdbDustPrediction",
    outputCollection: "OutputModule1",
  },
  module2: {
    id: "module2",
    title: "Charger Dust Filters Prediction",
    description:
      "ประเมินสภาพไส้กรองฝุ่นของ Charger จากข้อมูลสภาพแวดล้อมและประวัติการใช้งาน",
    inputCollection: "module2ChargerDustPrediction",
    outputCollection: "OutputModule2",
  },
  module3: {
    id: "module3",
    title: "Online / Offline Prediction",
    description:
      "วิเคราะห์การออนไลน์/ออฟไลน์ของ Charger หรือระบบ เพื่อแจ้งเตือนความผิดปกติของการเชื่อมต่อ",
    inputCollection: "module3ChargerOfflineAnalysis",
    outputCollection: "OutputModule3",
  },
  module4: {
    id: "module4",
    title: "AB Normal Power Supply Prediction",
    description:
      "วิเคราะห์สาเหตุความผิดปกติของระบบจ่ายกำลัง เช่น รถเรียกกระแสเกิน รถเรียกแรงดันเกิน หรือปัญหา Power Module",
    inputCollection: "module4AbnormalPowerPrediction",
    outputCollection: "OutputModule4",
  },
  module5: {
    id: "module5",
    title: "Network Prediction",
    description:
      "คาดการณ์และวิเคราะห์ปัญหา Network ที่มีผลต่อการสื่อสารของสถานีชาร์จ",
    inputCollection: "module5NetworkProblemPrediction",
    outputCollection: "OutputModule5",
  },
  module6: {
    id: "module6",
    title: "The Remaining Useful Life (RUL) Prediction",
    description:
      "คำนวณ RUL ของอุปกรณ์หลักในตู้ชาร์จ เช่น Power Module, DC Fan, PLC, Edgebox, Energy Meter และ PI5",
    inputCollection: "module6DcChargerRulPrediction",
    outputCollection: "OutputModule6",
  },
  module7: {
    id: "module7",
    title: "Root Cause Analysis Prediction",
    description:
      "วิเคราะห์หาสาเหตุรากของปัญหา (Root Cause) เมื่อเกิด Alarm หรือความผิดปกติ",
    inputCollection: "module7ChargerPowerIssue",
    outputCollection: "OutputModule7",
  },
};

/* ---------- Helper: แสดง object เป็น key-value ---------- */

function RenderObject({ data }: { data: Record<string, any> }) {
  if (!data) {
    return (
      <Typography className="tw-text-sm tw-text-blue-gray-400">
        ไม่พบข้อมูล
      </Typography>
    );
  }

  const renderValue = (value: any): JSX.Element => {
    if (value === null || value === undefined) {
      return (
        <span className="tw-text-blue-gray-400 tw-italic">
          null
        </span>
      );
    }
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return <span>{String(value)}</span>;
    }
    if (Array.isArray(value)) {
      return (
        <ul className="tw-list-disc tw-pl-5 tw-space-y-0.5">
          {value.map((v, idx) => (
            <li key={idx}>{renderValue(v)}</li>
          ))}
        </ul>
      );
    }
    if (typeof value === "object") {
      return (
        <div className="tw-border-l tw-border-blue-gray-100 tw-pl-3 tw-space-y-1">
          {Object.entries(value).map(([k, v]) => (
            <div
              key={k}
              className="tw-flex tw-gap-2 tw-text-xs"
            >
              <span className="tw-font-mono tw-text-blue-gray-500 tw-min-w-[120px]">
                {k}
              </span>
              <span className="tw-flex-1 tw-break-all">
                {renderValue(v)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return <span>{String(value)}</span>;
  };

  return (
    <div className="tw-space-y-1 tw-text-xs">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="tw-flex tw-gap-2">
          <span className="tw-font-mono tw-text-blue-gray-600 tw-min-w-[140px]">
            {key}
          </span>
          <span className="tw-flex-1 tw-break-all">
            {renderValue(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Helper: แสดง JSON ดิบ ---------- */

function RawJson({ data }: { data?: Record<string, any> | null }) {
  if (!data) return null;
  return (
    <pre className="tw-mt-3 tw-max-h-80 tw-overflow-auto tw-rounded-md tw-bg-blue-gray-900 tw-p-3 tw-text-[11px] tw-leading-snug tw-text-blue-gray-50">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

/* ---------- หน้า Module Detail ---------- */

export default function ModuleDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ moduleId: string }>();

  const moduleId = params?.moduleId ?? "module1";
  const stationId =
    searchParams.get("station_id") ?? "Klongluang3";

  const config: ModuleConfig =
    MODULE_CONFIG[moduleId] ??
    ({
      id: moduleId,
      title: moduleId,
      description: "",
      inputCollection: "",
      outputCollection: "",
    } as ModuleConfig);

  const [inputData, setInputData] = useState<any | null>(null);
  const [outputData, setOutputData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ปุ่มกลับไปหน้า AI Modules
  const goList = () => {
    const query = stationId
      ? `?station_id=${encodeURIComponent(stationId)}`
      : "";
    router.push(`/dashboard/ai${query}`, { scroll: false });
  };

  // ดึง input/output จาก backend
  useEffect(() => {
    if (!moduleId || !stationId) return;

    let cancelled = false;

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("access_token") || ""
            : "";

        const url = `${API_BASE}/modules/detail?module_id=${encodeURIComponent(
          String(moduleId)
        )}&station_id=${encodeURIComponent(stationId)}`;

        const res = await fetch(url, {
          headers: {
            ...(token
              ? { Authorization: `Bearer ${token}` }
              : {}),
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          credentials: token ? "omit" : "include",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();

        if (!cancelled) {
          setInputData(json.input ?? null);
          setOutputData(json.output ?? null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(
            e?.message || "Failed to fetch module detail"
          );
          setInputData(null);
          setOutputData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchDetail();

    return () => {
      cancelled = true;
    };
  }, [moduleId, stationId]);

  return (
    <div className="tw-mt-8 tw-space-y-4">
      {/* Header + ปุ่ม Back */}
      <div className="tw-flex tw-items-center tw-gap-3 tw-mb-4">
        <Button
          variant="outlined"
          size="sm"
          onClick={goList}
          className="tw-py-2 tw-px-2"
          title="กลับไปหน้า AI Modules"
        >
          <ArrowLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
        </Button>

        <div>
          <Typography variant="h5" className="tw-font-semibold">
            {config.title}
          </Typography>
          <div className="tw-flex tw-flex-wrap tw-gap-2 tw-mt-1">
            <span className="tw-inline-flex tw-items-center tw-rounded-full tw-bg-blue-gray-50 tw-px-3 tw-py-0.5 tw-text-[11px] tw-font-medium tw-text-blue-gray-700">
              Module ID:{" "}
              <span className="tw-ml-1 tw-font-mono">
                {config.id}
              </span>
            </span>
            {stationId && (
              <span className="tw-inline-flex tw-items-center tw-rounded-full tw-bg-green-50 tw-px-3 tw-py-0.5 tw-text-[11px] tw-font-medium tw-text-green-700">
                Station:{" "}
                <span className="tw-ml-1 tw-font-mono">
                  {stationId}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* error message กลางหน้า */}
      {error && (
        <Typography className="tw-text-sm tw-text-red-600">
          {error}
        </Typography>
      )}

      {/* description card */}
      {config.description && (
        <Card className="tw-border tw-border-blue-gray-50">
          <CardBody className="tw-p-4">
            <Typography className="tw-text-sm tw-text-blue-gray-700">
              {config.description}
            </Typography>
            <div className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-4 tw-text-xs tw-text-blue-gray-600">
              <div>
                <span className="tw-font-semibold">
                  Input collection:{" "}
                </span>
                <span className="tw-font-mono">
                  {config.inputCollection || "-"}
                </span>
              </div>
              <div>
                <span className="tw-font-semibold">
                  Output collection:{" "}
                </span>
                <span className="tw-font-mono">
                  {config.outputCollection || "-"}
                </span>
              </div>
              <div>
                <span className="tw-font-semibold">
                  MongoDB document:{" "}
                </span>
                <span className="tw-font-mono">
                  "{stationId}"
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* main content: Input / Output */}
      <div className="tw-grid tw-grid-cols-1 xl:tw-grid-cols-2 tw-gap-6">
        {/* INPUT */}
        <Card className="tw-border tw-border-blue-gray-50 tw-h-full">
          <CardHeader
            floated={false}
            shadow={false}
            color="transparent"
            className="tw-px-4 tw-py-3 tw-border-b tw-border-blue-gray-50 tw-bg-blue-50/40 tw-rounded-none"
          >
            <div className="tw-flex tw-items-center tw-justify-between">
              <Typography
                variant="h6"
                className="tw-text-sm tw-font-semibold tw-text-blue-gray-900"
              >
                ข้อมูลเข้า AI (Input)
              </Typography>
              <span className="tw-text-[11px] tw-font-mono tw-text-blue-gray-600">
                {config.inputCollection || "ไม่ระบุ collection"}
              </span>
            </div>
          </CardHeader>
          <CardBody className="tw-p-4 tw-space-y-3">
            <Typography className="tw-text-xs tw-text-blue-gray-600">
              ข้อมูลชุดนี้คือ feature ที่ใช้ป้อนเข้าโมเดล เช่น เวลา
              อุณหภูมิ ความชื้น สถานะของอุปกรณ์ และตัวแปรอื่น ๆ
              ที่จำเป็นต่อการทำนาย
            </Typography>

            {loading ? (
              <Typography className="tw-text-sm tw-text-blue-gray-500">
                กำลังโหลดข้อมูล...
              </Typography>
            ) : inputData ? (
              <>
                <RenderObject data={inputData} />
                <RawJson data={inputData} />
              </>
            ) : (
              <Typography className="tw-text-sm tw-text-blue-gray-400 tw-italic">
                ไม่พบข้อมูล input ล่าสุดจาก backend
              </Typography>
            )}
          </CardBody>
        </Card>

        {/* OUTPUT */}
        <Card className="tw-border tw-border-blue-gray-50 tw-h-full">
          <CardHeader
            floated={false}
            shadow={false}
            color="transparent"
            className="tw-px-4 tw-py-3 tw-border-b tw-border-blue-gray-50 tw-bg-green-50/40 tw-rounded-none"
          >
            <div className="tw-flex tw-items-center tw-justify-between">
              <Typography
                variant="h6"
                className="tw-text-sm tw-font-semibold tw-text-blue-gray-900"
              >
                ผลลัพธ์จาก AI (Output)
              </Typography>
              <span className="tw-text-[11px] tw-font-mono tw-text-blue-gray-600">
                {config.outputCollection || "ไม่ระบุ collection"}
              </span>
            </div>
          </CardHeader>
          <CardBody className="tw-p-4 tw-space-y-3">
            <Typography className="tw-text-xs tw-text-blue-gray-600">
              ส่วนนี้แสดงผลการทำนายของโมเดล เช่น Health Index, RUL,
              Label ของความผิดปกติ และข้อมูล meta อื่น ๆ เช่น
              model_version, prediction_timestamp
            </Typography>

            {loading ? (
              <Typography className="tw-text-sm tw-text-blue-gray-500">
                กำลังโหลดข้อมูล...
              </Typography>
            ) : outputData ? (
              <>
                <RenderObject data={outputData} />
                <RawJson data={outputData} />
              </>
            ) : (
              <Typography className="tw-text-sm tw-text-blue-gray-400 tw-italic">
                ไม่พบข้อมูล output ล่าสุดจาก backend
              </Typography>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}