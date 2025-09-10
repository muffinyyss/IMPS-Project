"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardBody, Typography, Switch } from "@material-tailwind/react";

const AICard = () => {
    const [isActive, setIsActive] = useState(false);

    const handleToggle = () => setIsActive(!isActive);

    return (
        <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-h-full">
            <CardHeader
                floated={false}
                shadow={false}
                className="tw-px-4 tw-py-3 tw-flex tw-items-center tw-justify-between"
            >
                <div className="tw-flex tw-items-center">
                    <img
                        src="/img/AI-icon.png"  
                        alt="PM Icon"
                        className="tw-h-12 tw-w-12 tw-mr-4"  
                    />
                    <Typography variant="h6" color="blue-gray">
                        Artificial Intelligence
                    </Typography>
                </div>

                <div className="tw-flex tw-items-center tw-gap-2">
                    <Typography className="tw-text-sm tw-text-blue-gray-600">
                        {isActive ? "Active" : "Inactive"}
                    </Typography>
                    <Switch checked={isActive} onChange={handleToggle} />
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
