"use client";

import React, { Fragment, useState ,useEffect} from "react";

// @material-tailwind/react
import {
  Card,
  Tab,
  TabsHeader,
  Tabs,
  Typography,
  CardBody,
  Accordion,
  AccordionHeader,
  AccordionBody,
} from "@material-tailwind/react";

// Widgets
import { PricingCard } from "@/widgets/cards";

// Icons
import { ChevronDownIcon } from "@heroicons/react/24/outline";

// Accordion icon
function Icon({ id, open }: { id: number; open: number }) {
  return (
    <ChevronDownIcon
      className={`${id === open ? "tw-rotate-180" : ""} tw-h-5 tw-w-5 tw-transition-transform`}
      strokeWidth={2}
    />
  );
}

export default function Landing() {
  const [users,setUsers] = useState<string[]>([]);

  useEffect(() => {
    fetch("http://localhost:8000")
    .then((res) => res.json())
    .then((data) => {
      console.log(data);
      setUsers(data.username)});
  },[]);

  const [open, setOpen] = useState(0);
  const [isAnnual, setIsAnnual] = React.useState(false);

  const handleOpen = (value: React.SetStateAction<number>) =>
    setOpen(open === value ? 0 : value);

  const PRICING_CARD_DATA = [
    {
      title: "starter",
      price: isAnnual ? 119 : 59,
      color: "white",
      actionColor: "gray",
      actionLabel: "join",
      actionRoute: "/auth/pricing-page",
      options: [
        { included: true, name: "2 team members" },
        { included: true, name: "20GB Cloud storage" },
        { included: false, name: "Integration help" },
        { included: false, name: "Sketch Files" },
        { included: false, name: "API Access" },
        { included: false, name: "Complete documentation" },
      ],
    },
    {
      title: "premium",
      price: isAnnual ? 159 : 89,
      color: "gray",
      actionColor: "white",
      actionLabel: "try premium",
      actionRoute: "/auth/pricing-page",
      options: [
        { included: true, name: "10 team members" },
        { included: true, name: "40GB Cloud storage" },
        { included: true, name: "Integration help" },
        { included: true, name: "Sketch Files" },
        { included: false, name: "API Access" },
        { included: false, name: "Complete documentation" },
      ],
    },
    {
      title: "enterprise",
      price: isAnnual ? 399 : 99,
      color: "white",
      actionColor: "gray",
      actionLabel: "join",
      actionRoute: "/auth/pricing-page",
      options: [
        { included: true, name: "Unlimited team members" },
        { included: true, name: "100GB Cloud storage" },
        { included: true, name: "Integration help" },
        { included: true, name: "Sketch Files" },
        { included: true, name: "API Access" },
        { included: true, name: "Complete documentation" },
      ],
    },
  ];

  return (
    <div className="tw-min-h-screen tw-bg-white">

      {/* HERO */}
      <section className="tw-mx-auto tw-max-w-7xl tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-10 tw-items-center tw-px-4 tw-pt-20 md:tw-pt-28 tw-mt-32 md:tw-mt-5">
        {/* Left text */}
        <div className="tw-order-2 md:tw-order-1">
          <Typography
            variant="h1"
            className="tw-font-extrabold tw-tracking-tight tw-text-4xl sm:tw-text-5xl lg:tw-text-6xl"
          >
            Ai Maintenance<br />as a service Platform
          </Typography>

          <Typography className="tw-mt-6 tw-max-w-xl tw-text-gray-600 tw-text-base sm:tw-text-lg">
            Journey to the edge of wonder and witness the Aurora Borealis,
            where nature’s most dazzling light show awaits to captivate your
            senses and ignite&nbsp; your imagination.
          </Typography>
          <ul>
          {users.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
          </ul>
        </div>

        {/* Right image */}
        <div className="tw-order-1 md:tw-order-2 tw-flex tw-justify-center">
          <img
            src="/img/charger.jpg"
            alt="images"
            className="tw-w-auto tw-max-h-[560px] tw-object-contain"
          />
        </div>
      </section>

      <div className="tw-mt-20"></div>
      <Card className="tw-mb-60 tw-border-0 tw-shadow-none">
        <CardBody className="tw-pt-20 tw-mt-20">
          <div className="tw-container tw-mx-auto">
            <div className="tw-mx-auto tw-mb-14 tw-max-w-[400px]">
              <Tabs id="pricing-tabs" value="monthly">
                <TabsHeader>
                  <Tab value="monthly" className="tw-py-2" onClick={() => setIsAnnual(false)}>
                    Monthly
                  </Tab>
                  <Tab value="annual" className="tw-py-2" onClick={() => setIsAnnual(true)}>
                    Annual
                  </Tab>
                </TabsHeader>
              </Tabs>
            </div>

            <div className="tw-grid tw-place-items-center tw-gap-6 md:tw-grid-cols-1 lg:tw-grid-cols-3">
              {PRICING_CARD_DATA.map((props) => (
                <PricingCard key={props.title} {...props} />
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ================= LOREM ================= */}
      <section className="tw-text-center tw-px-4 tw-pt-0 tw-pb-24">
        <h1 className="tw-text-5xl tw-font-extrabold tw-mb-5">Lorem Ipsum</h1>
        <p className="tw-max-w-[720px] tw-mx-auto tw-text-gray-700 tw-leading-7">
          Lorem Ipsum is simply dummy text of the printing and typesetting industry.
          Lorem Ipsum has been the industry's standard dummy text ever since the 1500s...
        </p>
      </section>
      <div className="tw-mt-20"></div>

    </div>
  );
}
