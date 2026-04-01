"use client";

import React, { useState, useEffect } from "react";

import {
  Card,
  Tab,
  TabsHeader,
  Tabs,
  CardBody,
} from "@/components/MaterialTailwind";

import { PricingCard } from "@/widgets/cards";
import { apiFetch, getAccessToken } from "@/utils/api";

// ปรับ type ตาม response จริงของ API
type PricingPlan = {
  title: string;
  price_monthly: number;
  price_annual: number;
  color: string;
  actionColor: string;
  actionLabel: string;
  actionRoute: string;
  options: { included: boolean; name: string }[];
};

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!getAccessToken());
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setPlans([]);
      return;
    }

    (async () => {
      try {
        const res = await apiFetch("/pricing");  // ← เปลี่ยน endpoint ให้ตรง API จริง
        const data = await res.json();
        setPlans(Array.isArray(data) ? data : []);
      } catch {
        setPlans([]);
      }
    })();
  }, [isLoggedIn]);

  // map plan → props ที่ PricingCard ต้องการ
  const pricingCards = plans.map((plan) => ({
    title: plan.title,
    price: isAnnual ? plan.price_annual : plan.price_monthly,
    color: plan.color,
    actionColor: plan.actionColor,
    actionLabel: plan.actionLabel,
    actionRoute: plan.actionRoute,
    options: plan.options,
  }));

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
              {pricingCards.map((props) => (
                <PricingCard key={props.title} {...props} />
              ))}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}