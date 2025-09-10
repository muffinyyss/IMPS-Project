type Props = {
  stationName?: string;
  model?: string;
  status?: string;
};

export default function StationInfo({
  stationName = "Station",
  model = "Charger Model",
  status = "Charger Status",
}: Props) {
  const statusColor =
    status.toLowerCase() === "online"
      ? "tw-bg-green-100 tw-text-green-700"
      : status.toLowerCase() === "offline"
      ? "tw-bg-red-100 tw-text-red-700"
      : "tw-bg-amber-100 tw-text-amber-700";

  return (
    <div className="tw-h-full tw-flex tw-flex-col">
      <div className="tw-flex-1 tw-overflow-auto tw-p-6">
        <dl className="tw-space-y-5">
          <div className="tw-grid tw-grid-cols-3 tw-gap-4">
            <dt className="tw-col-span-1 tw-text-sm tw-text-blue-gray-500">
              Station Name
            </dt>
            <dd className="tw-col-span-2 tw-text-blue-gray-900 tw-font-medium">
              {stationName}
            </dd>
          </div>

          <div className="tw-grid tw-grid-cols-3 tw-gap-4">
            <dt className="tw-col-span-1 tw-text-sm tw-text-blue-gray-500">
              Model
            </dt>
            <dd className="tw-col-span-2 tw-text-blue-gray-900 tw-font-medium">
              {model}
            </dd>
          </div>

          <div className="tw-grid tw-grid-cols-3 tw-gap-4">
            <dt className="tw-col-span-1 tw-text-sm tw-text-blue-gray-500">
              Status
            </dt>
            <dd className="tw-col-span-2">
              <span
                className={`tw-inline-flex tw-items-center tw-rounded-full tw-px-2.5 tw-py-1 tw-text-xs tw-font-semibold ${statusColor}`}
              >
                {status}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
