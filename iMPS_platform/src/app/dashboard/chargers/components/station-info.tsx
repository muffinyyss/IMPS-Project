"use client";
export type StationInfoProps = {
  station_name?: string;
  model?: string;
  status?: boolean | null; // ✅ ตรงกับข้อมูลจริง
  commit_date?: Date | null;
  number_available_use?: number | null;
  remaining_warranty?: number | null;
};

export default function StationInfo({
  station_name,
  model,
  status,
  commit_date,
  number_available_use,
  remaining_warranty,
}: StationInfoProps) {
  const statusColor =
    status === true
      ? "tw-bg-green-100 tw-text-green-700"
      : "tw-bg-red-100 tw-text-red-700";

  const statusText = status === true ? "Online" : "Offline";

  return (
    <div className="tw-h-full tw-flex tw-flex-col">
      <div className="tw-flex-1 tw-overflow-auto tw-p-6">
        <dl className="tw-space-y-5">
          {/* Station Name */}
          <div className="tw-grid tw-grid-cols-3 tw-gap-4">
            <dt className="tw-col-span-1 tw-text-sm tw-text-blue-gray-500 tw-text-left">
              Station Name
            </dt>
            <dd className="tw-col-span-2 tw-text-blue-gray-900 tw-font-medium tw-text-right tw-min-w-0 tw-truncate">
              {station_name ?? "-"}
            </dd>
          </div>

          {/* Model */}
          <div className="tw-grid tw-grid-cols-3 tw-gap-4">
            <dt className="tw-col-span-1 tw-text-sm tw-text-blue-gray-500 tw-text-left">
              Model
            </dt>
            <dd className="tw-col-span-2 tw-text-blue-gray-900 tw-font-medium tw-text-right tw-min-w-0 tw-truncate">
              {model ?? "-"}
            </dd>
          </div>

          {/* Status */}
          <div className="tw-grid tw-grid-cols-3 tw-gap-4">
            <dt className="tw-col-span-1 tw-text-sm tw-text-blue-gray-500 tw-text-left">
              Status
            </dt>
            <dd className="tw-col-span-2 tw-flex tw-justify-end">
              <span
                className={`tw-inline-flex tw-items-center tw-rounded-full tw-px-2.5 tw-py-1 tw-text-xs tw-font-semibold ${statusColor}`}
              >
                {statusText}
              </span>
            </dd>
          </div>

          {/*Commit Date */}
          <div className="tw-grid tw-grid-cols-3 tw-gap-4">
            <dt className="tw-col-span-1 tw-text-sm tw-text-blue-gray-500 tw-text-left">
              Commit Date
            </dt>
            <dd className="tw-col-span-2 tw-text-blue-gray-900 tw-font-medium tw-text-right tw-min-w-0 tw-truncate">
              {commit_date ? commit_date.toLocaleDateString() : "-"}
            </dd>
          </div>

          {/* Number of days available for use */}
          <div className="tw-grid tw-grid-cols-3 tw-gap-4">
            <dt className="tw-col-span-1 tw-text-sm tw-text-blue-gray-500 tw-text-left tw-whitespace-nowrap">
              Number of days available for use
            </dt>
            <dd className="tw-col-span-2 tw-text-blue-gray-900 tw-font-medium tw-text-right tw-min-w-0 tw-truncate">
              {number_available_use ?? "-"}
            </dd>
          </div>

          {/* Remaining Warranty */}
          <div className="tw-grid tw-grid-cols-3 tw-gap-4">
            <dt className="tw-col-span-1 tw-text-sm tw-text-blue-gray-500 tw-text-left tw-whitespace-nowrap">
              Remaining Warranty
            </dt>
            <dd className="tw-col-span-2 tw-text-blue-gray-900 tw-font-medium tw-text-right tw-min-w-0 tw-truncate">
              {remaining_warranty ?? "-"}
            </dd>
          </div>


        </dl>
      </div>
    </div>
  );
}
