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
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const res = await fetch(("http://localhost:8000/insert_users/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password, phone }),
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

  // const stations = [
  //   "สถานีกรุงเทพ",
  //   "สถานีเชียงใหม่",
  //   "สถานีโคราช",
  //   "สถานีหาดใหญ่",
  //   "สถานีพิษณุโลก",
  //   "สถานีนครสวรรค์",
  //   "สถานีสุราษฎร์ธานี",
  // ];

  // // state สำหรับ combobox เดียว
  // const [query, setQuery] = useState("");          // ค่าที่พิมพ์/เลือก
  // const [open, setOpen] = useState(false);         // เปิด/ปิด dropdown
  // const [active, setActive] = useState(-1);        // ไอเท็มที่กำลังโฟกัส (คีย์บอร์ด)
  // const inputRef = useRef<HTMLInputElement | null>(null);

  // const filtered = useMemo(() => {
  //   if (!query) return stations;
  //   return stations.filter((s) =>
  //     s.toLowerCase().includes(query.toLowerCase())
  //   );
  // }, [query, stations]);

  // const selectItem = (value: string) => {
  //   setQuery(value);
  //   setOpen(false);
  //   setActive(-1);
  // };

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
              <Input size="lg" label="Your phone number" type="text" />
            </div>

            <div className="tw-mb-3 tw-flex tw-flex-col tw-gap-6">
              <Typography
                variant="small"
                color="blue-gray"
                className="-tw-mb-3 !tw-font-medium"
              >
                Password
              </Typography>
              <Input size="lg" label="Your password" type="password" />
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

              {/* <Input
                inputRef={inputRef}
                size="lg"
                label="พิมพ์เพื่อค้นหา / เลือกสถานี"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                  setActive(-1);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                onBlur={() => {
                  // หน่วงเล็กน้อยเพื่อให้คลิก option ทันก่อน blur ปิด
                  setTimeout(() => setOpen(false), 120);
                }}
                crossOrigin=""
              />

              {open && (
                <div
                  className="tw-absolute tw-z-50 tw-top-[100%] tw-left-0 tw-right-0 tw-mt-2 tw-bg-white tw-border tw-rounded-lg tw-shadow-lg tw-max-h-64 tw-overflow-auto"
                  role="listbox"
                >
                  {filtered.length > 0 ? (
                    filtered.map((item, idx) => (
                      <button
                        type="button"
                        key={item}
                        role="option"
                        aria-selected={idx === active}
                        className={`tw-w-full tw-text-left tw-px-3 tw-py-2 hover:tw-bg-blue-gray-50 focus:tw-bg-blue-gray-50 ${idx === active ? "tw-bg-blue-gray-50" : ""
                          }`}
                        onMouseEnter={() => setActive(idx)}
                        onMouseDown={(e) => e.preventDefault()} // กัน blur
                        onClick={() => selectItem(item)}
                      >
                        {item}
                      </button>
                    ))
                  ) : (
                    <div className="tw-px-3 tw-py-2 tw-text-blue-gray-500">
                      ไม่พบสถานีที่ค้นหา
                    </div>
                  )}
                </div>
              )} */}
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
            {/* <div className="tw-space-y-4 tw-mt-8">
              <Button
                size="lg"
                color="white"
                className="tw-flex tw-items-center tw-gap-2 tw-justify-center tw-shadow-md"
                fullWidth
              >
                <svg
                  width="17"
                  height="16"
                  viewBox="0 0 17 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g clipPath="url(#clip0_1156_824)">
                    <path
                      d="M16.3442 8.18429C16.3442 7.64047 16.3001 7.09371 16.206 6.55872H8.66016V9.63937H12.9813C12.802 10.6329 12.2258 11.5119 11.3822 12.0704V14.0693H13.9602C15.4741 12.6759 16.3442 10.6182 16.3442 8.18429Z"
                      fill="#4285F4"
                    />
                    <path
                      d="M8.65974 16.0006C10.8174 16.0006 12.637 15.2922 13.9627 14.0693L11.3847 12.0704C10.6675 12.5584 9.7415 12.8347 8.66268 12.8347C6.5756 12.8347 4.80598 11.4266 4.17104 9.53357H1.51074V11.5942C2.86882 14.2956 5.63494 16.0006 8.65974 16.0006Z"
                      fill="#34A853"
                    />
                    <path
                      d="M4.16852 9.53356C3.83341 8.53999 3.83341 7.46411 4.16852 6.47054V4.40991H1.51116C0.376489 6.67043 0.376489 9.33367 1.51116 11.5942L4.16852 9.53356Z"
                      fill="#FBBC04"
                    />
                    <path
                      d="M8.65974 3.16644C9.80029 3.1488 10.9026 3.57798 11.7286 4.36578L14.0127 2.08174C12.5664 0.72367 10.6469 -0.0229773 8.65974 0.000539111C5.63494 0.000539111 2.86882 1.70548 1.51074 4.40987L4.1681 6.4705C4.8001 4.57449 6.57266 3.16644 8.65974 3.16644Z"
                      fill="#EA4335"
                    />
                  </g>
                  <defs>
                    <clipPath id="clip0_1156_824">
                      <rect
                        width="16"
                        height="16"
                        fill="white"
                        transform="translate(0.5)"
                      />
                    </clipPath>
                  </defs>
                </svg>
                <span>Sign in With Google</span>
              </Button>
              <Button
                size="lg"
                color="white"
                className="tw-flex tw-items-center tw-gap-2 tw-justify-center tw-shadow-md"
                fullWidth
              >
                <img src="/img/twitter-logo.svg" alt="Twitter logo" />
                <span>Sign in With Twitter</span>
              </Button>
            </div> */}
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
