"use client";
import Image from "next/image";
import React from "react";

// @material-tailwind/react
import {
  Card,
  CardBody,
  CardHeader,
  Typography,
} from "@material-tailwind/react";

// widgets
import { HorizontalBarChart } from "@/widgets/charts";
type Props = {};

export default function StationImage({ }: Props) {
  return (
    <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm">
      {/* <CardHeader
        floated={false}
        shadow={false}
        className="tw-flex tw-items-center tw-justify-between tw-gap-4 tw-px-6 tw-py-4"
      >
        <Typography variant="h6" color="blue-gray" className="tw-font-semibold">
          Station
        </Typography>
      </CardHeader> */}

      <CardBody className="tw-p-4">
        <div className="tw-relative tw-aspect-[16/9] tw-w-full tw-overflow-hidden tw-rounded-xl tw-bg-blue-gray-50">
          <Image
            src="/img/products/GIGAEV.webp"
            alt="GIGAEV Station"
            fill
            sizes="(min-width:1024px) 50vw, 100vw"
            objectFit="cover"
            objectPosition="center"
          />
        </div>
        {/* <div className="tw-w-full tw-overflow-hidden tw-rounded-xl tw-bg-blue-gray-50">
          <Image
            src="/img/products/GIGAEV.webp"
            alt="GIGAEV Station"
            width={800}       
            height={600}     
            className="tw-w-full tw-h-auto tw-rounded-xl tw-object-contain"
            priority
          />
        </div> */}
      </CardBody>
    </Card>
  );
}
