"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardBody, Typography, Switch } from "@material-tailwind/react";

const AICard = () => {
    const [isActive, setIsActive] = useState(false);

    const handleToggle = () => setIsActive(!isActive);

    return (
        <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-h-full">
            <CardHeader floated={false} shadow={false} color="transparent" className="tw-overflow-visible tw-rounded-none">
                <div className="tw-flex tw-items-center tw-justify-between">
                    <div className="tw-flex tw-items-center tw-gap-3">
                        {/* ใช้ <i> ของ Font Awesome */}
                        <i
                            className="fa-fw fa-solid fa-brain tw-text-xl tw-text-gray-800"
                            aria-hidden="true"
                        />
                        <div>
                            <Typography
                                variant="h6"
                                className="tw-leading-none tw-transition-colors tw-text-gray-900"
                            >
                                Artificial Intelligence
                            </Typography>
                            <Typography className="!tw-text-xs !tw-font-normal tw-transition-colors !tw-text-blue-gray-500">
                                Enabled
                            </Typography>
                        </div>
                    </div>
                    <div className="tw-flex tw-items-center tw-gap-2">
                        <Typography className="tw-text-sm tw-text-blue-gray-600">
                            {isActive ? "Active" : "Inactive"}
                        </Typography>
                        <Switch checked={isActive} onChange={handleToggle} />
                    </div>
                </div>
            </CardHeader>
            <CardBody className="tw-flex tw-flex-col tw-p-6">
                {isActive ? (
                    <Typography color="blue-gray">
                        Information about artificial intelligence will go here. You can add more details later.
                    </Typography>
                ) : (
                    <Typography color="blue-gray">
                        This section is currently inactive. You can add content here later.
                    </Typography>
                )}
            </CardBody>
        </Card>
    );
};

export default AICard;
