// import dynamic from "next/dynamic";

// // @material-tailwind/react
// import {
//   Typography,
//   Card,
//   CardHeader,
//   CardBody,
// } from "@/components/MaterialTailwind";

// // @components
// import ChargerSettingCard from "./components/chargerSetting-card";
// import ChargeBoxIDCard from "./components/ChargeBoxId";
// import ControlCard from "./components/ControlPanel";



// export default function ChargerSettingPage() {
//   return (
//     <div className="tw-mt-8 tw-mb-4">
//       {/* <ChargerSettingCard /> */}
//       <ChargeBoxIDCard/>
//       <ControlCard/>

//     </div>
//   );
// }

import dynamic from "next/dynamic";

// @material-tailwind/react
import {
  Typography,
  Card,
  CardHeader,
  CardBody,
} from "@/components/MaterialTailwind";

// @components
import ChargerSettingCard from "./components/chargerSetting-card";
import ChargeBoxIDCard from "./components/ChargeBoxId";
import ControlCard from "./components/ControlPanel";


export default function ChargerSettingPage() {
  return (
    <div className="tw-px-6 tw-py-8 tw-min-h-screen">
      <div className="tw-container tw-mx-auto">
        {/* Section Title */}
        {/* <Typography variant="h4" color="white" className="tw-font-semibold tw-text-center">
          Charger Settings
        </Typography> */}

        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-6 tw-mt-8">
          {/* Charge Box ID Card */}
          <Card className="tw-rounded-lg tw-shadow-lg">
            <ChargeBoxIDCard />
          </Card>

          {/* Control Panel Card */}
          <Card className="tw-rounded-lg tw-shadow-lg">
            <ControlCard />
          </Card>
        </div>

        <div className="tw-flex tw-flex-col tw-items-center tw-mt-8">
          {/* Add other sections like ChargerSettingCard if needed */}
          {/* <ChargerSettingCard /> */}
        </div>
      </div>
    </div>
  );
}



// import ChargeBoxId from "./components/ChargeBoxId";
// import ControlPanel from "./components/ControlPanel";
// import EvPanel from "./components/EvPanel";
// import PowerModule from "./components/PowerModule";
// import InfoPanel from "./components/InfoPanel";

// export default function SettingPage() {
//   return (
//     <main className="min-h-screen bg-black text-white">
//       <div className="mx-auto max-w-7xl p-6 md:p-10 space-y-6">
//         <h1 className="text-3xl font-semibold">Charger Setting</h1>

//         <div className="grid gap-6 md:grid-cols-3">
//           <div className="space-y-6">
//             <ChargeBoxId />
//             <ControlPanel />
//             <InfoPanel />
//           </div>

//           <div className="md:col-span-1 lg:col-span-1">
//             <EvPanel />
//           </div>

//           <div className="md:col-span-1 lg:col-span-1">
//             <PowerModule />
//           </div>
//         </div>
//       </div>
//     </main>
//   );
// }
