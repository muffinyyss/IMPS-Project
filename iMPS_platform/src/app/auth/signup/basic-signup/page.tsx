"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useMemo, useRef, useState, useEffect } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

// @material-tailwind/react
import {
  Input,
  Checkbox,
  Button,
  Typography,
  Select,
  Option,
} from "@/components/MaterialTailwind";

import { useRouter } from "next/navigation";


export default function BasicSignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const res = await fetch(("http://localhost:8000/insert_users/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password, phone ,company}),
      });

      if (!res.ok) {
        throw new Error("Failed to insert user");
      }else{
        alert("Register success ✅");
        router.push("/auth/signin/basic"); // <-- redirect ไป login
      }

      const data = await res.json();
      console.log(data);
      setMessage(`User created: ${data.username} (${data.email})`);
    } catch (error) {
      console.error(error);
      setMessage("Error creating user");
    }
  };

  const router = useRouter();

  const [query, setQuery] = useState("");
  const [stations, setStations] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);        // ไอเท็มที่กำลังโฟกัส (คีย์บอร์ด)

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const res = await fetch(`http://localhost:8000/stations/?q=${query}`);
        const data = await res.json();
        setStations(data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchStations();
  }, [query]); // เรียกใหม่ทุกครั้งที่ query เปลี่ยน

  const selectItem = (item: string) => {
    setQuery(item);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((prev) => Math.min(prev + 1, stations.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      if (open && active >= 0 && stations[active]) {
        e.preventDefault();
        selectItem(stations[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <section className="tw-grid tw-grid-cols-1 xl:tw-grid-cols-2 tw-items-center tw-h-full">
      <div className="tw-p-8 tw-hidden xl:tw-block">
        <img
          src="/img/pattern.png"
          alt="image"
          className="tw-object-cover tw-object-center tw-max-h-[calc(100vh-4rem)] tw-w-full tw-rounded-2xl"
        />
      </div>
      <div className="tw-w-full tw-min-h-screen tw-grid tw-place-items-center tw-relative">

        <div className="tw-absolute tw-top-4 tw-left-4 tw-z-10 tw-mt-4">
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


        <div className="tw-w-full">
          <div className="tw-text-center">
            <Typography variant="h2" className="!tw-font-bold tw-mb-4">
              Join Us Today
            </Typography>
            <Typography className="tw-text-lg tw-font-normal !tw-text-blue-gray-500">
              Enter your information to register.
            </Typography>
          </div>
          <form className="tw-mt-8 tw-mb-2 tw-mx-auto tw-w-80 tw-max-w-screen-lg lg:tw-w-1/2" onSubmit={handleSubmit}>
            <div className="tw-mb-3 tw-flex tw-flex-col tw-gap-6">
              <Typography
                variant="small"
                color="blue-gray"
                className="-tw-mb-3 !tw-font-medium"
              >
                Your username
              </Typography>
              <Input size="lg" label="Your username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>

            <div className="tw-mb-3 tw-flex tw-flex-col tw-gap-6">
              <Typography
                variant="small"
                color="blue-gray"
                className="-tw-mb-3 !tw-font-medium"
              >
                Email
              </Typography>
              <Input size="lg" label="Your email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="tw-mb-3 tw-flex tw-flex-col tw-gap-6">
              <Typography
                variant="small"
                color="blue-gray"
                className="-tw-mb-3 !tw-font-medium"
              >
                Phone number
              </Typography>
              <Input size="lg" label="Your phone number" type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            <div className="tw-mb-3 tw-flex tw-flex-col tw-gap-6">
              <Typography
                variant="small"
                color="blue-gray"
                className="-tw-mb-3 !tw-font-medium"
              >
                Password
              </Typography>
              <Input size="lg" label="Your password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}/>
            </div>

            <div className="tw-mb-3 tw-flex tw-flex-col tw-gap-6">
              <Typography
                variant="small"
                color="blue-gray"
                className="-tw-mb-3 !tw-font-medium"
              >
                Comppany Name
              </Typography>
              <Input size="lg" label="Company name" type="text" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>

            <div className="tw-mb-3 tw-flex tw-flex-col tw-gap-2 tw-relative">
              <Typography
                variant="small"
                color="blue-gray"
                className="-tw-mb-1 !tw-font-medium"
              >
                เลือกสถานี
              </Typography>

              <Input
                size="lg"
                label="พิมพ์เพื่อค้นหา / เลือกสถานี"
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                  setActive(-1);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                onBlur={() => setTimeout(() => setOpen(false), 120)}
                placeholder="พิมพ์เพื่อค้นหา / เลือกสถานี"
                className="border p-2 rounded w-full"
                crossOrigin=""
              />

              {open && (
                // <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border rounded shadow max-h-64 overflow-auto">
                <div
                  className="tw-absolute tw-z-50 tw-top-[100%] tw-left-0 tw-right-0 tw-mt-2 tw-bg-white tw-border tw-rounded-lg tw-shadow-lg tw-max-h-64 tw-overflow-auto"
                  role="listbox"
                >
                  {stations.length > 0 ? (
                    stations.map((item, idx) => (
                      <button
                        type="button"
                        key={item}
                        role="option"

                        // className="w-full text-left px-3 py-2 hover:bg-blue-100"
                        className={`tw-w-full tw-text-left tw-px-3 tw-py-2 hover:tw-bg-blue-gray-50 focus:tw-bg-blue-gray-50 ${idx === active ? "tw-bg-blue-gray-50" : ""
                          }`}
                        onMouseEnter={() => setActive(idx)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectItem(item)}
                      >
                        {item}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-gray-500">
                      ไม่พบสถานีที่ค้นหา
                    </div>
                  )}
                </div>
              )}
            </div>

            <Checkbox
              label={
                <Typography
                  variant="small"
                  className="tw-flex tw-items-center tw-justify-start tw-font-medium !tw-text-blue-gray-500"
                >
                  I agree the&nbsp;
                  <a
                    href="#"
                    className="tw-font-meduim !tw-text-blue-gray-500 tw-transition-colors hover:tw-text-gray-900 tw-underline"
                  >
                    Terms and Conditions
                  </a>
                </Typography>
              }
              containerProps={{ className: "-tw-ml-2.5" }}
            />
            <Button className="tw-mt-6" fullWidth type="submit">
              Register Now
            </Button>
            {message && <p>{message}</p>}
            
            <Typography
              variant="paragraph"
              className="tw-text-center !tw-text-blue-gray-500 tw-font-medium tw-mt-4"
            >
              Already have an account?
              <Link
                href="/auth/signin/basic"
                className="tw-text-blue-gray-900 tw-ml-1"
              >
                Sign in
              </Link>
            </Typography>
          </form>
        </div>
      </div>
    </section>
  );
}
