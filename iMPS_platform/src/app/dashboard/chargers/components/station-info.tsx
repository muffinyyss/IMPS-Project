"use client";
export type StationInfoProps = {
  station_name?: string;
  model?: string;
  status?: boolean | null; // ✅ ตรงกับข้อมูลจริง
  commit_date?: string | null;
  warranty_year?: string | null;
};

export default function StationInfo({
  station_name,
  model,
  status,
  commit_date,
  warranty_year,
}: StationInfoProps) {
  const statusColor =
    status === true
      ? "tw-bg-green-100 tw-text-green-700"
      : "tw-bg-red-100 tw-text-red-700";

  const statusText = status === true ? "Online" : "Offline";

  // คำนวณจำนวนวันที่เปิดใช้งานแล้วตั้งแต่วันที่ commit
  const calculateDaysInUse = (commitDateStr: string | null | undefined): string => {
    if (!commitDateStr) return "-";
    try {
      const commitDate = new Date(commitDateStr);
      const today = new Date();
      const diffTime = today.getTime() - commitDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return "-";

      const years = Math.floor(diffDays / 365);
      const months = Math.floor((diffDays % 365) / 30);
      const days = Math.floor((diffDays % 365) % 30);

      if (years > 0) {
        return `${years} year${years > 1 ? "s" : ""} ${months} month${months !== 1 ? "s" : ""}`;
      }
      if (months > 0) {
        return `${months} month${months !== 1 ? "s" : ""} ${days} day${days !== 1 ? "s" : ""}`;
      }
      return `${days} day${days !== 1 ? "s" : ""}`;
    } catch {
      return "-";
    }
  };

  const daysInUse = calculateDaysInUse(commit_date);

  // คำนวณจำนวนวันที่เหลือของประกัน
  const calculateRemainingWarrantyDays = (
    commitDateStr: string | null | undefined,
    warrantyYears: number | null | undefined
  ): string => {
    if (!commitDateStr || !warrantyYears) return "-";
    try {
      const commitDate = new Date(commitDateStr);
      const warrantyEndDate = new Date(
        commitDate.getFullYear() + warrantyYears,
        commitDate.getMonth(),
        commitDate.getDate()
      );
      const today = new Date();
      const diffTime = warrantyEndDate.getTime() - today.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) return "Expired";

      const years = Math.floor(diffDays / 365);
      const months = Math.floor((diffDays % 365) / 30);
      const days = Math.floor((diffDays % 365) % 30);

      if (years > 0) {
        return `${years} year${years > 1 ? "s" : ""} ${months} month${months !== 1 ? "s" : ""}`;
      }
      if (months > 0) {
        return `${months} month${months !== 1 ? "s" : ""} ${days} day${days !== 1 ? "s" : ""}`;
      }
      return `${days} day${days !== 1 ? "s" : ""}`;
    } catch {
      return "-";
    }
  };

  const remainingWarrantyDays = calculateRemainingWarrantyDays(
    commit_date,
    warranty_year ? parseInt(warranty_year) : null
  );

  // ฟังก์ชันแปลงวันที่เป็นรูปแบบ dd mon yyyy
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      const day = date.getDate().toString().padStart(2, "0");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    } catch {
      return "-";
    }
  };

  // ฟังก์ชันคำนวณวันหมดประกัน
  const calculateWarrantyExpirationDate = (
    commitDateStr: string | null | undefined,
    warrantyYears: number | null | undefined
  ): string => {
    if (!commitDateStr || !warrantyYears) return "-";
    try {
      const commitDate = new Date(commitDateStr);
      const warrantyEndDate = new Date(
        commitDate.getFullYear() + warrantyYears,
        commitDate.getMonth(),
        commitDate.getDate()
      );
      return formatDate(warrantyEndDate.toISOString());
    } catch {
      return "-";
    }
  };

  const warrantyExpirationDate = calculateWarrantyExpirationDate(
    commit_date,
    warranty_year ? parseInt(warranty_year) : null
  );

  // ฟังก์ชันกำหนดสีตามจำนวนวันที่เหลือของประกัน
  const getWarrantyColor = (warrantyDaysStr: string): string => {
    if (warrantyDaysStr === "Expired") {
      return "tw-bg-red-50 tw-text-red-700"; // แดง - หมดแล้ว
    }

    // แยกเอาจำนวนวันทั้งหมด
    const parts = warrantyDaysStr.split(" ");
    let totalDays = 0;

    for (let i = 0; i < parts.length; i++) {
      if (parts[i + 1]?.includes("year")) {
        totalDays += parseInt(parts[i]) * 365;
      } else if (parts[i + 1]?.includes("day")) {
        totalDays += parseInt(parts[i]);
      }
    }

    // กำหนดสีตามจำนวนวัน
    if (totalDays > 365) {
      return "tw-bg-green-50 tw-text-green-700"; // เขียว - เหลือมากกว่า 1 ปี
    } else if (totalDays > 90) {
      return "tw-bg-blue-50 tw-text-blue-700"; // ฟ้า - เหลือ 3 เดือนขึ้นไป
    } else if (totalDays > 30) {
      return "tw-bg-amber-50 tw-text-amber-700"; // เหลือง - เหลือประมาณ 1 เดือน
    } else {
      return "tw-bg-red-50 tw-text-red-700"; // แดง - เหลือน้อยกว่า 1 เดือน
    }
  };

  return (
    <div className="tw-h-full tw-flex tw-flex-col">
      <div className="tw-flex-1 tw-overflow-auto tw-p-6">
        <dl className="tw-space-y-6">
          {/* Station Information Section */}
          <div className="tw-border-b tw-border-blue-gray-200 tw-pb-4">
            <h3 className="tw-text-sm tw-font-semibold tw-text-blue-gray-700 tw-mb-4">Station Information</h3>

            {/* Station Name */}
            <div className="tw-grid tw-grid-cols-3 tw-gap-4 tw-mb-3">
              <dt className="tw-col-span-1 tw-text-sm tw-text-blue-gray-500 tw-text-left tw-font-medium">
                Station Name
              </dt>
              <dd className="tw-col-span-2 tw-text-blue-gray-900 tw-font-medium tw-text-right tw-min-w-0 tw-truncate">
                {station_name ?? "-"}
              </dd>
            </div>

            {/* Model */}
            <div className="tw-grid tw-grid-cols-3 tw-gap-4 tw-mb-3">
              <dt className="tw-col-span-1 tw-text-sm tw-text-blue-gray-500 tw-text-left tw-font-medium">
                Model
              </dt>
              <dd className="tw-col-span-2 tw-text-blue-gray-900 tw-font-medium tw-text-right tw-min-w-0 tw-truncate">
                {model ?? "-"}
              </dd>
            </div>

            {/* Status */}
            <div className="tw-grid tw-grid-cols-3 tw-gap-4">
              <dt className="tw-col-span-1 tw-text-sm tw-text-blue-gray-500 tw-text-left tw-font-medium">
                Status
              </dt>
              <dd className="tw-col-span-2 tw-flex tw-justify-end">
                <span
                  className={`tw-inline-flex tw-items-center tw-rounded-full tw-px-3 tw-py-1 tw-text-xs tw-font-semibold ${statusColor}`}
                >
                  {statusText}
                </span>
              </dd>
            </div>
          </div>

          {/* Service Period Section */}
          <div className="tw-border-b tw-border-blue-gray-200 tw-pb-4">
            <h3 className="tw-text-sm tw-font-semibold tw-text-blue-gray-700 tw-mb-4">Service Period</h3>

            {/* Commit Date */}
            <div className="tw-grid tw-grid-cols-3 tw-gap-4 tw-mb-3">
              <dt className="tw-col-span-1 tw-text-sm tw-text-blue-gray-500 tw-text-left tw-font-medium">
                Commit Date
              </dt>
              <dd className="tw-col-span-2 tw-text-blue-gray-900 tw-font-medium tw-text-right tw-min-w-0 tw-truncate">
                {formatDate(commit_date)}
              </dd>
            </div>

            {/* Days in Use */}
            <div className="tw-grid tw-grid-cols-3 tw-gap-4">
              <dt className="tw-col-span-1 tw-text-sm tw-text-blue-gray-500 tw-text-left tw-whitespace-nowrap tw-font-medium">
                Days in Service
              </dt>
              <dd className="tw-col-span-2 tw-text-blue-gray-900 tw-font-medium tw-text-right tw-min-w-0 tw-truncate">
                <span className="tw-inline-flex tw-items-center tw-px-2.5 tw-py-1 tw-rounded tw-bg-blue-50 tw-text-blue-700">
                  {daysInUse}
                </span>
              </dd>
            </div>
          </div>

          {/* Warranty Section */}
          <div className="tw-pb-4">
            <h3 className="tw-text-sm tw-font-semibold tw-text-blue-gray-700 tw-mb-4">Warranty Information</h3>

            {/* Remaining Warranty */}
            <div className="tw-grid tw-grid-cols-3 tw-gap-4 tw-mb-3">
              <dt className="tw-col-span-1 tw-text-sm tw-text-blue-gray-500 tw-text-left tw-whitespace-nowrap tw-font-medium">
                Remaining Warranty
              </dt>
              <dd className="tw-col-span-2 tw-text-blue-gray-900 tw-font-medium tw-text-right tw-min-w-0 tw-truncate">
                {warranty_year ?? "-"} {warranty_year ? "years" : ""}
              </dd>
            </div>

            {/* Warranty Expiration Date */}
            <div className="tw-grid tw-grid-cols-3 tw-gap-4 tw-mb-3">
              <dt className="tw-col-span-1 tw-text-sm tw-text-blue-gray-500 tw-text-left tw-whitespace-nowrap tw-font-medium">
                Expiration Date
              </dt>
              <dd className="tw-col-span-2 tw-text-blue-gray-900 tw-font-medium tw-text-right tw-min-w-0 tw-truncate">
                {warrantyExpirationDate}
              </dd>
            </div>

            {/* Days Until Warranty Expires */}
            <div className="tw-grid tw-grid-cols-3 tw-gap-4">
              <dt className="tw-col-span-1 tw-text-sm tw-text-blue-gray-500 tw-text-left tw-whitespace-nowrap tw-font-medium">
                Days Remaining
              </dt>
              <dd className="tw-col-span-2 tw-text-blue-gray-900 tw-font-medium tw-text-right tw-min-w-0 tw-truncate">
                <span className={`tw-inline-flex tw-items-center tw-px-2.5 tw-py-1 tw-rounded tw-text-sm tw-font-medium ${getWarrantyColor(remainingWarrantyDays)}`}>
                  {remainingWarrantyDays}
                </span>
              </dd>
            </div>
          </div>
        </dl>
      </div>
    </div>
  );
}
