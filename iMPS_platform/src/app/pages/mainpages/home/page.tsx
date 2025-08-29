"use client";
import Link from "next/link";
import { Button } from "@/components/MaterialTailwind";
import React, { Fragment, useState } from "react";

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

// @heroicons/react
import { PricingCard } from "@/widgets/cards";

// @heroicons/react
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { AuthFooter, Navbar } from "@/widgets/layout";

// Accordion
function Icon({ id, open }: { id: number; open: number }) {
  return (
    <ChevronDownIcon
      className={`${id === open ? "tw-rotate-180" : ""
        } tw-h-5 tw-w-5 tw-transition-transform`}
      strokeWidth={2}
    />
  );
}

export default function Landing() {
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
        {
          included: true,
          name: "2 team members",
        },
        {
          included: true,
          name: "20GB Cloud storage",
        },
        {
          included: false,
          name: "Integration help",
        },
        {
          included: false,
          name: "Sketch Files",
        },
        {
          included: false,
          name: "API Access",
        },
        {
          included: false,
          name: "Complete documentation",
        },
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
        {
          included: true,
          name: "10 team members",
        },
        {
          included: true,
          name: "40GB Cloud storage",
        },
        {
          included: true,
          name: "Integration help",
        },
        {
          included: true,
          name: "Sketch Files",
        },
        {
          included: false,
          name: "API Access",
        },
        {
          included: false,
          name: "Complete documentation",
        },
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
        {
          included: true,
          name: "Unlimited team members",
        },
        {
          included: true,
          name: "100GB Cloud storage",
        },
        {
          included: true,
          name: "Integration help",
        },
        {
          included: true,
          name: "Sketch Files",
        },
        {
          included: true,
          name: "API Access",
        },
        {
          included: true,
          name: "Complete documentation",
        },
      ],
    },
  ];



  return (
    <div className="tw-min-h-screen tw-bg-white">
      {/* NAVBAR */}
      <nav className="tw-sticky tw-top-0 tw-z-40 tw-bg-white">
        <div className="tw-mx-auto tw-max-w-7xl tw-h-20 tw-grid tw-grid-cols-[1fr_auto_1fr] tw-items-center tw-px-4">
          {/* Brand */}
          <a href="/" className="tw-flex tw-items-center tw-space-x-2">
            <span className="tw-text-4xl tw-font-extrabold">
              <span className="tw-text-yellow-400">i</span>
              <span className="tw-text-gray-900">MPS</span>
            </span>
          </a>

          {/* Center nav */}
          <ul className="tw-flex tw-items-center tw-space-x-10 tw-text-gray-700">
            <li><a href="/pages/mainpages/home" className="tw-font-medium hover:tw-text-black">Home</a></li>
            <li><a href="#" className="tw-font-medium hover:tw-text-black">About</a></li>
            <li><a href="#" className="tw-font-medium hover:tw-text-black">Contract</a></li>
            <li><a href="/dashboard/analytics" className="tw-font-medium hover:tw-text-black">Dashboard</a></li>
          </ul>

          {/* Right actions */}
          <div className="tw-flex tw-justify-end">
            <Link
              href="/auth/signin/basic"
              // className="tw-rounded-full tw-bg-white tw-border tw-border-gray-300 tw-px-5 tw-h-10 tw-shadow-sm tw-inline-flex tw-items-center tw-justify-center tw-text-sm"
              className="tw-rounded-full tw-bg-white tw-border tw-border-gray-300 tw-px-5 tw-h-10 
             tw-shadow-sm tw-inline-flex tw-items-center tw-justify-center tw-text-sm
             hover:tw-bg-black hover:tw-text-white hover:tw-border-black"
            >
              Login
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section
        className="tw-mx-auto tw-max-w-7xl tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-10 tw-items-center tw-px-4 tw-pt-20 md:tw-pt-28 tw-mt-32 md:tw-mt-40">
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
        </div>

        {/* Right image */}
        <div className="tw-order-1 md:tw-order-2 tw-flex tw-justify-center">
          {/* เปลี่ยน src ให้เป็นรูปของคุณเอง */}
          <img
            src="/img/images.png"
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
                  <Tab
                    value="monthly"
                    className="tw-py-2"
                    onClick={() => setIsAnnual(false)}
                  >
                    Monthly
                  </Tab>
                  <Tab
                    value="annual"
                    className="tw-py-2"
                    onClick={() => setIsAnnual(true)}
                  >
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

            {/* <div className="tw-my-16 tw-grid tw-place-items-center">
              <Typography
                color="blue-gray"
                variant="h6"
                className="tw-my-10 tw-opacity-60"
              >
                More than 50+ brands trust Material
              </Typography>
              <div className="tw-grid tw-place-items-center md:tw-grid-cols-2 lg:tw-grid-cols-6">
                <img
                  className="tw-h-auto tw-w-72"
                  src="https://demos.creative-tim.com/material-dashboard-pro-react/static/media/logo-coinbase.87e91c7f318f2d82f46e78469976128b.svg"
                  alt="coinbase"
                />
                <img
                  className="tw-h-auto tw-w-72"
                  src="https://demos.creative-tim.com/material-dashboard-pro-react/static/media/logo-nasa.c5d11f8820bfde5fd64db0074156e06c.svg"
                  alt="nasa"
                />
                <img
                  className="tw-h-auto tw-w-72"
                  src="https://demos.creative-tim.com/material-dashboard-pro-react/static/media/logo-netflix.432ed6b5c31b9bcab9a38e32bf46a1e9.svg"
                  alt="netflix"
                />
                <img
                  className="tw-h-auto tw-w-72"
                  src="https://demos.creative-tim.com/material-dashboard-pro-react/static/media/logo-pinterest.844709031a3c1266979e933c371e043a.svg"
                  alt="pinterest"
                />
                <img
                  className="tw-h-auto tw-w-72"
                  src="https://demos.creative-tim.com/material-dashboard-pro-react/static/media/logo-spotify.7e255dc67938d13ff97cc8f16812d325.svg"
                  alt="spotify"
                />
                <img
                  className="tw-h-auto tw-w-72"
                  src="https://demos.creative-tim.com/material-dashboard-pro-react/static/media/logo-vodafone.b3e8486c0cac220bc3a31c9eab049b21.svg"
                  alt="vodafone"
                />
              </div>
            </div> */}

            {/* <div className="tw-my-24 tw-mx-auto tw-grid tw-max-w-5xl tw-place-items-center">
              <Typography color="blue-gray" variant="h2">
                Frequently Asked Questions
              </Typography>
              <Typography
                color="blue-gray"
                variant="paragraph"
                className="tw-my-4 tw-opacity-60 !tw-font-normal"
              >
                A lot of people don&apos;t appreciate the moment until
                it&apos;s passed. I&apos;m not trying my hardest, and I&apos;m
                not trying to do
              </Typography>
              <Fragment>
                <Accordion
                  open={open === 1}
                  icon={<Icon id={1} open={open} />}
                >
                  <AccordionHeader onClick={() => handleOpen(1)}>
                    How do I order?
                  </AccordionHeader>
                  <AccordionBody className="!tw-font-normal !tw-text-blue-gray-500">
                    We&apos;re not always in the position that we want to be
                    at. We&apos;re constantly growing. We&apos;re constantly
                    making mistakes. We&apos;re constantly trying to express
                    ourselves and actualize our dreams. If you have the
                    opportunity to play this game of life you need to
                    appreciate every moment. A lot of people don&apos;t
                    appreciate the moment until it&apos;s passed.
                  </AccordionBody>
                </Accordion>
                <Accordion
                  open={open === 2}
                  icon={<Icon id={2} open={open} />}
                >
                  <AccordionHeader onClick={() => handleOpen(2)}>
                    How can I make the payment?
                  </AccordionHeader>
                  <AccordionBody className="!tw-font-normal !tw-text-blue-gray-500">
                    It really matters and then like it really doesn&apos;t
                    matter. What matters is the people who are sparked by it.
                    And the people who are like offended by it, it
                    doesn&apos;t matter. Because it&apos;s about motivating
                    the doers. Because I&apos;m here to follow my dreams and
                    inspire other people to follow their dreams, too.
                    We&apos;re not always in the position that we want to be
                    at. We&apos;re constantly growing. We&apos;re constantly
                    making mistakes. We&apos;re constantly trying to express
                    ourselves and actualize our dreams. If you have the
                    opportunity to play this game of life you need to
                    appreciate every moment. A lot of people don&apos;t
                    appreciate the moment until it&apos;s passed.
                  </AccordionBody>
                </Accordion>
                <Accordion
                  open={open === 3}
                  icon={<Icon id={3} open={open} />}
                >
                  <AccordionHeader onClick={() => handleOpen(3)}>
                    How much time does it take to recieve the order?
                  </AccordionHeader>
                  <AccordionBody className="!tw-font-normal !tw-text-blue-gray-500">
                    The time is now for it to be okay to be great. People in
                    this world shun people for being great. For being a bright
                    color. For standing out. But the time is now to be okay to
                    be the greatest you. Would you believe in what you believe
                    in, if you were the only one who believed it? If
                    everything I did failed - which it doesn&apos;t, it
                    actually succeeds - just the fact that I&apos;m willing to
                    fail is an inspiration. People are so scared to lose that
                    they don&apos;t even try. Like, one thing people
                    can&apos;t say is that I&apos;m not trying, and I&apos;m
                    not trying my hardest, and I&apos;m not trying to do the
                    best way I know how.
                  </AccordionBody>
                </Accordion>
                <Accordion
                  open={open === 4}
                  icon={<Icon id={4} open={open} />}
                >
                  <AccordionHeader onClick={() => handleOpen(4)}>
                    Can I resell the products?
                  </AccordionHeader>
                  <AccordionBody className="!tw-font-normal !tw-text-blue-gray-500">
                    I always felt like I could do anything. That&apos;s the
                    main thing people are controlled by! Thoughts- their
                    perception of themselves! They&apos;re slowed down by
                    their perception of themselves. If you&apos;re taught you
                    can&apos;t do anything, you won&apos;t do anything. I was
                    taught I could do everything. If everything I did failed -
                    which it doesn&apos;t, it actually succeeds - just the
                    fact that I&apos;m willing to fail is an inspiration.
                    People are so scared to lose that they don&apos;t even
                    try. Like, one thing people can&apos;t say is that
                    I&apos;m not trying, and I&apos;m not trying my hardest,
                    and I&apos;m not trying to do the best way I know how.
                  </AccordionBody>
                </Accordion>
                <Accordion
                  open={open === 5}
                  icon={<Icon id={5} open={open} />}
                >
                  <AccordionHeader onClick={() => handleOpen(5)}>
                    Where do I find the shipping details?
                  </AccordionHeader>
                  <AccordionBody className="!tw-font-normal !tw-text-blue-gray-500">
                    There&apos;s nothing I really wanted to do in life that I
                    wasn&apos;t able to get good at. That&apos;s my skill.
                    I&apos;m not really specifically talented at anything
                    except for the ability to learn. That&apos;s what I do.
                    That&apos;s what I&apos;m here for. Don&apos;t be afraid
                    to be wrong because you can&apos;t learn anything from a
                    compliment. I always felt like I could do anything.
                    That&apos;s the main thing people are controlled by!
                    Thoughts- their perception of themselves! They&apos;re
                    slowed down by their perception of themselves. If
                    you&apos;re taught you can&apos;t do anything, you
                    won&apos;t do anything. I was taught I could do
                    everything.
                  </AccordionBody>
                </Accordion>
              </Fragment>
            </div> */}
          </div>
        </CardBody>
      </Card>

      {/* ================= LOREM ================= */}
      <section className="tw-text-center tw-px-4 tw-pt-16 tw-pb-24">
        <h1 className="tw-text-5xl tw-font-extrabold tw-mb-5">Lorem Ipsum</h1>
        <p className="tw-max-w-[720px] tw-mx-auto tw-text-gray-700 tw-leading-7">
          Lorem Ipsum is simply dummy text of the printing and typesetting industry.
          Lorem Ipsum has been the industry's standard dummy text ever since the 1500s,
          when an unknown printer took a galley of type and scrambled it to make a type specimen book.
          It has survived not only five centuries, but also the leap into electronic typesetting,
          remaining essentially unchanged. It was popularised in the 1960s with the release of
          Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing
          software like Aldus PageMaker including versions of Lorem Ipsum.
        </p>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="tw-border-t tw-border-gray-200 tw-bg-gray-50 tw-pt-16 tw-pb-12">
        <div className="tw-mx-auto tw-max-w-7xl tw-px-4">
          <div className="tw-grid tw-gap-10 sm:tw-grid-cols-2 lg:tw-grid-cols-4">
            {/* Help */}
            <div>
              <h3 className="tw-text-base tw-font-semibold tw-text-gray-900 tw-mb-4">Help</h3>
              <ul className="tw-list-disc tw-pl-5 tw-space-y-2 tw-text-sm tw-text-gray-700">
                <li>Be our partner</li>
                <li>Terms of Service</li>
                <li>Privacy Policy</li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="tw-text-base tw-font-semibold tw-text-gray-900 tw-mb-4">Contact</h3>
              <ul className="tw-list-disc tw-pl-5 tw-space-y-2 tw-text-sm tw-text-gray-700">
                <li>Address</li>
                <li>Facebook</li>
                <li>Phone number</li>
              </ul>
            </div>

            {/* Menu */}
            <div>
              <h3 className="tw-text-base tw-font-semibold tw-text-gray-900 tw-mb-4">Menu</h3>
              <ul className="tw-list-disc tw-pl-5 tw-space-y-2 tw-text-sm tw-text-gray-700">
                <li>Package</li>
                <li>About</li>
                <li>Customer</li>
              </ul>
            </div>

            {/* Ourservice */}
            <div>
              <h3 className="tw-text-base tw-font-semibold tw-text-gray-900 tw-mb-4">Ourservice</h3>
              <ul className="tw-list-disc tw-pl-5 tw-space-y-2 tw-text-sm tw-text-gray-700">
                <li>EV Charge</li>
                <li>IMPS</li>
              </ul>
            </div>
          </div>
        </div>
      </footer>


    </div>

  );
}
