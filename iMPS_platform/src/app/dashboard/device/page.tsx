// import React from "react";
// import dynamic from "next/dynamic";

// // @material-tailwind/react
// import {
//   Card,
//   CardHeader,
//   CardBody,
//   Typography,
//   Chip,
// } from "@/components/MaterialTailwind";

// // @heroicons/react
// import { ArrowUturnRightIcon } from "@heroicons/react/24/solid";

// import MiniCards from "./components/mini-cards";

// export default function Widgets() {
//   return (
//     <React.Fragment>

//       <div className="tw-grid tw-gap-6 lg:tw-grid-cols-3">
//         {/* Mini Card */}
//         <MiniCards />

//       </div>
//     </React.Fragment>
//   );
// }


import React from "react";

// @material-tailwind/react
import {
  Card,
  CardHeader,
  CardBody,
  Typography,
  Chip,
} from "@/components/MaterialTailwind";

// @heroicons/react
import { ArrowUturnRightIcon } from "@heroicons/react/24/solid";

import MiniCards1 from "./components/mini-cards1";
import MiniCards2 from "./components/mini-cards2";

export default function Widgets() {
  return (
    <React.Fragment>
      <div
        className="
          tw-grid tw-gap-6 tw-mt-8 tw-grid-cols-1
          md:tw-grid-cols-[260px_minmax(0,1fr)]
          lg:tw-grid-cols-[320px_minmax(0,1fr)_320px]
        "
      >
        {/* Column 1: fixed ~260px */}
        <div className="tw-min-w-0">
          <MiniCards1 />
        </div>

        {/* Column 2: flexible (กินพื้นที่ที่เหลือ) */}
        {/* <div className="tw-min-w-0">
          <div className="tw-rounded-lg tw-overflow-hidden">
            <img
              src="/img/charger-1.png"
              alt="Charger"
              className="
                tw-w-full tw-h-[1000px] tw-object-contain
                tw-max-h-[70vh] 
              "
            />
          </div>
        </div> */}
        {/* Column 2: ให้รูปพอดีเต็มจอ */}
        <div className="tw-flex tw-items-center tw-justify-center
                tw-h-[calc(100vh-96px)]">
          <img
            src="/img/charger-1.png"
            alt="Charger"
            className="tw-h-full tw-w-auto tw-object-contain tw-select-none"
          />
        </div>


        {/* Column 3: fixed ~320px (ซ่อนบนจอเล็กอยู่แล้วเพราะเป็น 1–2 คอลัมน์) */}
        <div className="tw-min-w-0">
          <MiniCards2 />
        </div>
      </div>
    </React.Fragment>
  );
}


