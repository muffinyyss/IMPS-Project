"use client";

import { useState } from "react";
import { Typography, Button, Slider, Card } from "@material-tailwind/react";

export default function ChargerControl() {
    const [maxCurrent, setMaxCurrent] = useState(50); // Default value for Dynamic Max Current
    const [maxPower, setMaxPower] = useState(50); // Default value for Dynamic Max Power
    const [charging, setCharging] = useState(false); // Charging state

    const handleStartCharging = () => setCharging(true);
    const handleStopCharging = () => setCharging(false);

    return (
        <div className="tw-space-y-10">
            <Card className="tw-p-6 tw-bg-black tw-rounded-lg">
                <Typography variant="h5" className="tw-font-semibold">
                    Control
                </Typography>
                <div className="tw-space-y-4 tw-mt-4">
                    {/* Dynamic Max Current Slider */}
                    <div className="tw-flex tw-flex-col">
                        <Typography variant="small">
                            Dynamic Max Current:
                        </Typography>
                        <Slider
                            value={maxCurrent}
                            onChange={(e) => setMaxCurrent(Number(e.target.value))}
                            min={0}
                            max={100}
                            step={1}
                            className="tw-mt-2"
                        />
                    </div>

                    {/* Dynamic Max Power Slider */}
                    <div className="tw-flex tw-flex-col">
                        <Typography variant="small">
                            Dynamic Max Power:
                        </Typography>
                        <Slider
                            value={maxPower}
                            onChange={(e) => setMaxCurrent(Number(e.target.value))}
                            min={0}
                            max={100}
                            step={1}
                            className="tw-mt-2"
                        />
                    </div>

                    {/* Stop and Start Charging Buttons */}
                    <div className="tw-flex tw-space-x-4 tw-mt-6">
                        <Button
                            color="red"
                            fullWidth={false}
                            onClick={handleStopCharging}
                            disabled={!charging}
                        >
                            STOP CHARGING1
                        </Button>
                        <Button
                            color="green"
                            fullWidth={false}
                            onClick={handleStartCharging}
                            disabled={charging}
                        >
                            START CHARGING2
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
