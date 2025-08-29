"use client";
import React from "react";

export default function SiteFooter() {
    return (
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
    );
}
