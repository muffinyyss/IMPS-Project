"use client";

import { chargerSettingData } from "@/data";
import { Card, Typography } from "@material-tailwind/react";

export default function ChargerSetting() {
    return (
        <div className="tw-space-y-10">
            {chargerSettingData.map((sec) => (
                <section key={sec.section} className="tw-space-y-4">
                    {/* เช็คว่า section เป็น "Charge Box" หรือไม่ */}
                    {sec.section === "Charge Box" && (
                        <div className="tw-flex tw-flex-col tw-p-4 tw-rounded-lg tw-w-full tw-max-w-xs">
                            <Typography variant="small">
                                Charge Box ID :
                            </Typography>
                            <Typography
                                variant="h5"
                                color="blue-gray"
                                className="tw-font-semibold tw-mt-1"
                            >
                                {sec.items[0]?.value}
                            </Typography>
                        </div>
                    )}
                </section>
            ))}
        </div>
    );
}
