// // "use client";
// // import React from "react";

// // // @material-tailwind/react
// // import {
// //   Card,
// //   CardBody,
// //   Input,
// //   Typography,
// //   Select,
// //   Option,
// //   CardHeader,
// //   Popover,
// //   PopoverHandler,
// //   PopoverContent,
// // } from "@/components/MaterialTailwind";

// // // day picker
// // import { format } from "date-fns";
// // import { DayPicker } from "react-day-picker";

// // // @heroicons/react
// // import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";

// // type Props = {};

// // export default function BasicInfo({ }: Props) {
// //   const [date, setDate] = React.useState();

// //   return (
// //     <Card
// //       className="tw-mb-6 tw-scroll-mt-4 tw-border tw-border-blue-gray-100 tw-shadow-sm"
// //       id="Basic Info"
// //     >
// //       <CardHeader shadow={false} floated={false}>
// //         <Typography variant="h5" color="blue-gray">
// //           Profile
// //         </Typography>
// //       </CardHeader>
// //       <CardBody className="tw-flex tw-flex-col">
// //         <div className="tw-mb-6 tw-flex tw-flex-col tw-items-end tw-gap-6 md:tw-flex-row">
// //           <Input label="Username" />
// //           <Input label="Email" />
// //         </div>
// //         <div className="tw-flex tw-flex-col tw-items-end tw-gap-6 md:tw-flex-row">
// //           <Input label="Phone number" />
// //           <Input label="Role" />
// //           {/* <Select
// //             label="Role"
// //             containerProps={{
// //               className: "tw-min-w-max",
// //             }}
// //           >
// //             <Option>Male</Option>
// //             <Option>Female</Option>
// //           </Select> */}
// //         </div>
// //       </CardBody>
// //     </Card>
// //   );
// // }


// "use client";
// import React from "react";

// // @material-tailwind/react
// import {
//   Card,
//   CardBody,
//   Input,
//   Typography,
//   CardHeader,
// } from "@/components/MaterialTailwind";

// type Props = {};

// export default function BasicInfo({ }: Props) {
//   return (
//     <Card
//       className="tw-mb-6 tw-scroll-mt-4 tw-border tw-border-blue-gray-100 tw-shadow-sm"
//       id="Basic Info"
//     >
//       <CardHeader shadow={false} floated={false}>
//         <Typography variant="h5" color="blue-gray">
//           Profile
//         </Typography>
//       </CardHeader>

//       {/* เปลี่ยนเป็น 1 คอลัมน์ */}
//       <CardBody className="tw-flex tw-flex-col">
//         <div className="tw-grid tw-grid-cols-1 tw-gap-6">
//           <Input label="Username" containerProps={{ className: "tw-w-full" }} />
//           <Input label="Email" containerProps={{ className: "tw-w-full" }} />
//           <Input label="Phone number" containerProps={{ className: "tw-w-full" }} />
//           <Input label="Role" containerProps={{ className: "tw-w-full" }} />
//         </div>
//       </CardBody>


//     </Card>
//   );
// }

"use client";
import React from "react";

// @material-tailwind/react
import {
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Input,
  Typography,
  Button,
} from "@/components/MaterialTailwind";

type Props = {};

export default function BasicInfo({ }: Props) {
  const handleEdit = () => {
    // TODO: ใส่ลอจิกตอนกด Edit (เช่น focus ช่องแรก, เปิด modal, ฯลฯ)
  };

  const handleSave = () => {
    // TODO: ใส่ลอจิกบันทึกข้อมูล
  };

  return (
    <Card
      className="tw-mb-6 tw-scroll-mt-4 tw-border tw-border-blue-gray-100 tw-shadow-sm tw-rounded-xl tw-overflow-hidden"
      id="Profile"
    >
      <CardHeader shadow={false} floated={false}>
        <Typography variant="h5" color="blue-gray">
          Profile
        </Typography>
        <Typography variant="small" className="!tw-text-blue-gray-500">
          ข้อมูลโปรไฟล์ของคุณ
        </Typography>
      </CardHeader>

      {/* ฟอร์ม 1 คอลัมน์ */}
      <CardBody className="tw-flex tw-flex-col">
        <div className="tw-grid tw-grid-cols-1 tw-gap-6">
          <Input label="Username" containerProps={{ className: "tw-w-full" }} />
          <Input label="Email" containerProps={{ className: "tw-w-full" }} />
          <Input label="Phone number" containerProps={{ className: "tw-w-full" }} />
          <Input label="Role" containerProps={{ className: "tw-w-full" }} />
        </div>
      </CardBody>

      {/* ปุ่ม Edit & Save ด้านล่างตลอด */}
      <CardFooter className="tw-flex tw-items-center tw-justify-end tw-gap-3 tw-border-t tw-bg-white/60 tw-backdrop-blur-sm tw-mt-4">
        <Button onClick={handleEdit} variant="outlined" color="gray" className="tw-px-6">
          Edit
        </Button>
        <Button onClick={handleSave} variant="gradient" className="tw-px-6">
          Save
        </Button>
      </CardFooter>
    </Card>
  );
}

