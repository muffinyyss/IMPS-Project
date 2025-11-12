"use client";



export type StationInfoProps = {
  station_name?: string;
  model?: string;
  status?: boolean | null; // ✅ ตรงกับข้อมูลจริง
};

export default function StationInfo({
  station_name,
  model,
  status,
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
        </dl>
      </div>
    </div>
  );
}
