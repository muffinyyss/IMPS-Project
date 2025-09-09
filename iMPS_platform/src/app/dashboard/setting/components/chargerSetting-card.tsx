// "use client";

// import { chargerSettingData } from "@/data";
// import { InfoCard } from "@/widgets/cards";

// export default function ChargerSetting() {
//   return (
//     <div className="tw-space-y-10">
//       {chargerSettingData.map((sec) => (
//         <section key={sec.section} className="tw-space-y-4">
//           {/* หัวข้อ section */}
//           <h3 className="tw-text-xl tw-font-semibold tw-text-gray-800 tw-border-b tw-pb-2">
//             {sec.section}
//           </h3>

//           {/* grid responsive */}
//           <div className="tw-grid gap-6 sm:tw-grid-cols-2 lg:tw-grid-cols-3 xl:tw-grid-cols-4">
//             {sec.items.map((item, i) => (
//               <InfoCard
//                 key={i}
//                 title={item.title}
//                 value={item.value}
//                 unit={item.unit}
//               />
//             ))}
//           </div>
//         </section>
//       ))}
//     </div>
//   );
// }

"use client";

import { chargerSettingData } from "@/data";
import { Card, Typography } from "@material-tailwind/react";

export default function ChargerSetting() {
  return (
    <div className="tw-space-y-10">
      {chargerSettingData.map((sec) => (
        <section key={sec.section} className="tw-space-y-4">
          {/* หัวข้อหลัก */}
          <Typography
            variant="h5"
            className="tw-font-semibold tw-text-gray-800 tw-border-b tw-pb-2"
          >
            {sec.section}
          </Typography>

          {/* แสดงรายการการ์ดย่อย */}
          <div className="tw-grid gap-6 sm:tw-grid-cols-2 lg:tw-grid-cols-3 xl:tw-grid-cols-4">
            {sec.items.map((item, i) => (
              <Card
                key={`${sec.section}-${i}`}
                className="tw-border tw-border-gray-200 tw-bg-white tw-shadow-md hover:tw-shadow-lg tw-transition tw-rounded-lg"
              >
                <div className="tw-flex tw-flex-col tw-p-4">
                  <Typography
                    variant="small"
                    className="tw-mb-1 tw-text-gray-500 tw-font-medium"
                  >
                    {item.title}
                  </Typography>
                  <Typography
                    variant="h5"
                    color="blue-gray"
                    className={`tw-font-bold tw-text-lg ${item.value === "fault"
                        ? "tw-text-red-500"
                        : item.value === "Operative"
                          ? "tw-text-green-600"
                          : ""
                      }`}
                  >
                    {item.value} {item.unit ? item.unit : ""}
                  </Typography>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
