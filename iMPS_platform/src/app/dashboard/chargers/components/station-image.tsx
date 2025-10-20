// // iMPS_platform/src/app/dashboard/chargers/components/station-image.tsx
// "use client";
// import Image from "next/image";
// import React from "react";
// import { Card, CardBody } from "@material-tailwind/react";

// type Props = {
//   src?: string;
//   alt?: string;
// };

// export default function StationImage({
//   src = "/img/products/GIGAEV.webp",
//   alt = "GIGAEV Station",
// }: Props) {
//   return (
//     <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm">
//       <CardBody className="tw-p-4">
//         <div className="tw-relative tw-aspect-[16/9] tw-w-full tw-overflow-hidden tw-rounded-xl tw-bg-blue-gray-50">
//           <Image
//             src={src}
//             alt={alt}
//             fill
//             sizes="(min-width:1024px) 50vw, 100vw"
//             className="tw-object-cover tw-object-center"
//           />
//         </div>
//       </CardBody>
//     </Card>
//   );
// }
