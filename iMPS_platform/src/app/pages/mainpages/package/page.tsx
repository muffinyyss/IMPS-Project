/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from "react";

// @material-tailwind/react
import {
  Card,
  Tab,
  TabsHeader,
  Tabs,
  CardBody,
} from "@/components/MaterialTailwind";   // ✅ ใช้ path เดียวกับหน้าอื่น

import { PricingCard } from "@/widgets/cards";

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);

  const PRICING_CARD_DATA = [
    {
      title: "starter",
      price: isAnnual ? 119 : 59,
      color: "white",
      actionColor: "gray",
      actionLabel: "join",
      actionRoute: "/auth/signup/basic",   // ✅ ชี้ไปหน้า signup
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
      actionRoute: "/auth/signup/basic",   // ✅ ชี้ไปหน้า signup
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
      actionRoute: "/auth/signup/basic",   // ✅ ชี้ไปหน้า signup
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
    <div className="tw-mx-auto tw-mt-8 tw-w-full tw-px-12">
      <Card className="tw-mb-44 tw-shadow-black/20 tw-border tw-border-blue-gray-100 tw-shadow-sm">
        <CardBody className="tw-pt-12">
          <div className="tw-container tw-mx-auto">
            <div className="tw-mx-auto tw-mb-14 tw-max-w-[400px]">
              <Tabs id="pricing-tabs" value="monthly">
                <TabsHeader>
                  <Tab value="monthly" className="tw-py-2" onClick={() => setIsAnnual(false)}>
                    Monthly
                  </Tab>
                  <Tab value="annual" className="tw-py-2" onClick={() => setIsAnnual(true)}>
                    Annualy
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
    </div>
  );
}