"use client";

import React from "react";
import { PhoneIcon, EnvelopeIcon } from "@heroicons/react/24/outline";

export default function ContactPage() {
    const [form, setForm] = React.useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        message: "",
    });

    const onChange: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> = (e) => {
        const { name, value } = e.target;
        setForm((p) => ({ ...p, [name]: value }));
    };

    const onSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
        e.preventDefault();
        console.log("Contact form:", form);
        alert("ขอบคุณที่ติดต่อเรา!");
    };

    const inputCls =
        "tw-w-full tw-border tw-border-gray-300 tw-rounded-md tw-px-4 tw-py-2 tw-text-gray-900 " +
        "tw-outline-none focus:tw-ring-2 focus:tw-ring-black focus:tw-border-black";

    return (
        <div className="tw-min-h-screen tw-flex tw-flex-col tw-bg-white">

            <main className="tw-flex-1">
                <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-min-h-[70vh]">
                    {/* LEFT: Info */}
                    <aside className="tw-bg-yellow-500 tw-text-black">
                        <div className="tw-max-w-xl tw-px-6 md:tw-px-10 tw-py-14 md:tw-py-20">
                            <h1 className="tw-text-3xl tw-font-extrabold">Contact US</h1>
                            <p className="tw-mt-6 tw-leading-7 tw-text-black/80">
                                Lorem Ipsum is simply dummy text of the printing and typesetting industry.
                                Lorem Ipsum has been the industry&apos;s standard dummy text ever since the 1500s
                            </p>

                            <div className="tw-mt-10 tw-space-y-5">
                                <div className="tw-flex tw-items-center tw-gap-3">
                                    <PhoneIcon className="tw-w-5 tw-h-5" aria-hidden="true" />
                                    <span className="tw-font-medium">+66 123 4567 89</span>
                                </div>
                                <div className="tw-flex tw-items-center tw-gap-3">
                                    <EnvelopeIcon className="tw-w-5 tw-h-5" aria-hidden="true" />
                                    <span className="tw-font-medium">service@email.com</span>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* RIGHT: Form */}
                    <section className="tw-bg-white">
                        <div className="tw-px-6 md:tw-px-10 tw-py-14 md:tw-py-20">
                            <h2 className="tw-text-2xl tw-font-semibold">Send us a message</h2>

                            <form onSubmit={onSubmit} className="tw-mt-8 tw-space-y-6">
                                {/* First & Last name */}
                                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-6">
                                    <div>
                                        <label className="tw-block tw-text-sm tw-font-medium tw-mb-2">First name</label>
                                        <input
                                            name="firstName"
                                            value={form.firstName}
                                            onChange={onChange}
                                            className={inputCls}
                                            autoComplete="given-name"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="tw-block tw-text-sm tw-font-medium tw-mb-2">Last name</label>
                                        <input
                                            name="lastName"
                                            value={form.lastName}
                                            onChange={onChange}
                                            className={inputCls}
                                            autoComplete="family-name"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="tw-block tw-text-sm tw-font-medium tw-mb-2">Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={form.email}
                                        onChange={onChange}
                                        className={inputCls}
                                        autoComplete="email"
                                        required
                                    />
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="tw-block tw-text-sm tw-font-medium tw-mb-2">Phone number</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={form.phone}
                                        onChange={onChange}
                                        className={inputCls}
                                        autoComplete="tel"
                                    />
                                </div>

                                {/* Message */}
                                <div>
                                    <label className="tw-block tw-text-sm tw-font-medium tw-mb-2">Message</label>
                                    <textarea
                                        name="message"
                                        value={form.message}
                                        onChange={onChange}
                                        className={inputCls + " tw-min-h-[220px]"}
                                    />
                                </div>

                                <div className="tw-pt-2">
                                    <button
                                        type="submit"
                                        className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-md tw-bg-black tw-text-white tw-px-6 tw-py-3 tw-font-medium hover:tw-opacity-90"
                                    >
                                        Send
                                    </button>
                                </div>
                            </form>
                        </div>
                    </section>
                </div>
            </main>

        </div>
    );
}
