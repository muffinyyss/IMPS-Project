"use client";

/* eslint-disable @next/next/no-img-element */
import React,{useState} from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
// @material-tailwind/react
import {
  Input,
  Checkbox,
  Button,
  Typography,
} from "@/components/MaterialTailwind";
import { headers } from "next/headers";

export default function BasicPage() {
  const [username,setUsername] = useState("");
  const [password,setPassword] = useState("");
  const [message,setMessage] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try{
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);

      const res = await fetch("http://localhost:8000/login/",{
        method: "POST",
        // headers: {"Content-Type": "application/json"},
        // body: JSON.stringify({username,password}),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      if (res.ok){
        const data = await res.json();
        setMessage(data.message);

        localStorage.setItem("user",JSON.stringify(data));

        router.push("/pages/mainpages/home");
      }else{
        setMessage("Login failed ❌");
      }
    }catch (err) {
      console.error(err);
      setMessage("Server error");
    }
  };


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
          <form className="tw-mt-8 tw-mb-2 tw-mx-auto tw-w-80 tw-max-w-screen-lg lg:tw-w-1/2" onSubmit={handleSubmit}>
            <div className="tw-mb-1 tw-flex tw-flex-col tw-gap-6">
              <Typography
                variant="small"
                color="blue-gray"
                className="-tw-mb-3 !tw-font-medium"
              >
                Your username
              </Typography>
              <Input size="lg" label="Your username" 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)}
              />
              <Typography
                variant="small"
                color="blue-gray"
                className="-mb!-3 font-medium"
              >
                Password
              </Typography>
              <Input type="password" size="lg" label="Password"
              value={password}
              onChange={(e) => setPassword((e.target.value))} />
            </div>

            <Button className="tw-mt-6" fullWidth type="submit">
              Sign In
            </Button>
            {message && <p>{message}</p>}

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
