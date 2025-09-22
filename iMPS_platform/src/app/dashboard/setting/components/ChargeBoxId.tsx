"use client";
import React from "react";
import Card from "./chargerSetting-card";

export default function ChargeBoxId({ id = "Elex_DC_PT_Wangnoi4_1" }: { id?: string }) {
    return (
        <Card title="Charge Box ID :">
            <div className="tw-text-lg sm:tw-text-xl tw-font-semibold tw-text-blue-gray-900">
                {id}
            </div>
        </Card>
    );
}
