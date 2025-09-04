/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

// @material-tailwind/react
import {
  Input,
  Checkbox,
  Button,
  Typography,
} from "@/components/MaterialTailwind";

export default function BasicPage() {
  return (
    <section className="tw-grid tw-grid-cols-1 xl:tw-grid-cols-2 tw-items-center tw-h-full">

      {/* ปุ่ม Back มุมซ้ายบน */}
      <div className="tw-absolute tw-top-4 tw-left-4">
        <Link href="/">
          <Button
            variant="outlined"
            size="sm"
            className="tw-flex tw-items-center tw-gap-2"
          >
            <ArrowLeftIcon className="tw-h-5 tw-w-5" />
          </Button>
        </Link>
      </div>

      <div className="tw-w-full tw-min-h-screen tw-grid tw-place-items-center">
        <div className="tw-w-full">
          <div className="tw-text-center">
            <Typography variant="h2" className="!tw-font-bold tw-mb-4">
              Sign In
            </Typography>
            <Typography className="tw-text-lg !tw-font-normal !tw-text-blue-gray-500">
              Enter your username and password to Sign In.
            </Typography>
          </div>
          <form className="tw-mt-8 tw-mb-2 tw-mx-auto tw-w-80 tw-max-w-screen-lg lg:tw-w-1/2">
            <div className="tw-mb-1 tw-flex tw-flex-col tw-gap-6">
              <Typography
                variant="small"
                color="blue-gray"
                className="-tw-mb-3 !tw-font-medium"
              >
                Your username
              </Typography>
              <Input size="lg" label="Your username" />
              <Typography
                variant="small"
                color="blue-gray"
                className="-mb!-3 font-medium"
              >
                Password
              </Typography>
              <Input type="password" size="lg" label="Password" />
            </div>

            <Button className="tw-mt-6" fullWidth>
              Sign In
            </Button>

            <div className="tw-flex tw-items-center tw-justify-between tw-gap-2 tw-mt-6">
              <Checkbox
                label={
                  <Typography
                    variant="small"
                    color="gray"
                    className="tw-flex tw-items-center tw-justify-start !tw-font-medium"
                  >
                    Subscribe me to newsletter
                  </Typography>
                }
                containerProps={{ className: "-tw-ml-2.5" }}
              />
              {/* <Typography
                variant="small"
                className="!tw-font-medium tw-text-gray-900"
              >
                <a href="#">Forgot Password</a>
              </Typography> */}
            </div>

            <Typography className="tw-text-center !tw-text-blue-gray-500 !tw-font-medium tw-mt-4">
              Not registered?
              <Link
                href="/auth/signup/basic-signup"
                className="tw-text-gray-900 tw-ml-1"
              >
                Create account
              </Link>
            </Typography>
          </form>
        </div>
      </div>
      <div className="tw-p-8 tw-hidden xl:tw-block">
        <img
          src="/img/pattern.png"
          alt="image"
          className="tw-object-cover tw-object-center tw-max-h-[calc(100vh-4rem)] tw-w-full tw-rounded-2xl"
        />
      </div>
    </section>
  );
}
