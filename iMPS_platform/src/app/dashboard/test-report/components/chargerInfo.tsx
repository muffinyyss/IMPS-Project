// import React from "react";

// export default function ChargerInfo() {
//   return (
//     <div>
//       {/* Charger Info Section */}
//       <div className="tw-space-y-3 tw-text-sm">
//         <p>
//           <span className="tw-font-medium tw-text-blue-gray-800">
//             Test Standard :
//           </span>{" "}
//           DIN 70121
//         </p>
//         <p>
//           <span className="tw-font-medium tw-text-blue-gray-800">
//             Charging Method :
//           </span>{" "}
//           CCS2/2
//         </p>

//         <p className="tw-font-semibold tw-mt-4 tw-text-blue-gray-900">
//           Charger Device
//         </p>
//         <p>
//           <span className="tw-font-medium tw-text-blue-gray-800">Type :</span>{" "}
//           DC Charger 150kW
//         </p>
//         <p>
//           <span className="tw-font-medium tw-text-blue-gray-800">Brand :</span>{" "}
//           Flexx Fast
//         </p>
//         <p>
//           <span className="tw-font-medium tw-text-blue-gray-800">Model :</span>{" "}
//           FD150A
//         </p>
//         <p>
//           <span className="tw-font-medium tw-text-blue-gray-800">
//             Location :
//           </span>{" "}
//           PT BanNaDoem
//         </p>
//       </div>

//       {/* Buttons */}
//       <div className="tw-flex tw-flex-wrap tw-gap-3 tw-mt-6">
//         <button className="tw-flex-1 tw-bg-gray-800 tw-text-white tw-px-4 tw-py-2 tw-rounded-lg hover:tw-bg-gray-700">
//           Upload Test Report
//         </button>
//         <button className="tw-flex-1 tw-border tw-border-gray-400 tw-px-4 tw-py-2 tw-rounded-lg hover:tw-bg-gray-100">
//           Download Test Report
//         </button>
//       </div>
//     </div>
//   );
// }


import React from "react";

export default function ChargerInfo() {
  return (
    <div>
      {/* Charger Info Section */}
      <div className="tw-space-y-6">
        {/* Info Block */}
        <div className="tw-grid tw-grid-cols-2 tw-gap-y-3 tw-text-sm">
          <span className="tw-font-medium tw-text-blue-gray-800">
            Test Standard :
          </span>
          <span className="tw-text-blue-gray-700">DIN 70121</span>

          <span className="tw-font-medium tw-text-blue-gray-800">
            Charging Method :
          </span>
          <span className="tw-text-blue-gray-700">CCS2/2</span>
        </div>

        {/* Divider */}
        <hr className="tw-border-t tw-border-gray-200" />

        {/* Charger Device Section */}
        <div>
          <p className="tw-font-semibold tw-text-blue-gray-900 tw-mb-3">
            Charger Device
          </p>
          <div className="tw-grid tw-grid-cols-2 tw-gap-y-3 tw-text-sm">
            <span className="tw-font-medium tw-text-blue-gray-800">Type :</span>
            <span className="tw-text-blue-gray-700">DC Charger 150kW</span>

            <span className="tw-font-medium tw-text-blue-gray-800">
              Brand :
            </span>
            <span className="tw-text-blue-gray-700">Flexx Fast</span>

            <span className="tw-font-medium tw-text-blue-gray-800">
              Model :
            </span>
            <span className="tw-text-blue-gray-700">FD150A</span>

            <span className="tw-font-medium tw-text-blue-gray-800">
              Location :
            </span>
            <span className="tw-text-blue-gray-700">PT BanNaDoem</span>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="tw-flex tw-justify-end tw-gap-4 tw-mt-8">
        <button className="tw-bg-gray-800 tw-text-white tw-px-4 tw-py-2 tw-rounded-lg hover:tw-bg-gray-700">
          Upload Test Report
        </button>
        <button className="tw-border tw-border-gray-400 tw-px-4 tw-py-2 tw-rounded-lg hover:tw-bg-gray-100">
          Download Test Report
        </button>
      </div>

    </div>

    
  );
}
