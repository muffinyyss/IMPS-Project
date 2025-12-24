"use client";
import React, { useState } from "react";
import {
    Card,
    CardHeader,
    CardBody,
    Typography,
    Switch, // นำเข้า Switch
} from "@material-tailwind/react";

import {
    AdjustmentsHorizontalIcon,
    ChatBubbleLeftEllipsisIcon,
    BookOpenIcon,
    TruckIcon,
    PaintBrushIcon,
} from "@heroicons/react/24/solid";


const EVENTS_CARD_DATA = [
    {
        icon: AdjustmentsHorizontalIcon,
        title: "Condition-Base",
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit",
    },
    {
        icon: ChatBubbleLeftEllipsisIcon,
        title: "Ask expert",
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit",
    },
    // {
    //     icon: BookOpenIcon,
    //     title: "STD Maintenance Procedure",
    //     description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit",
    // },
    // {
    //     icon: BookOpenIcon,
    //     title: "WI",
    //     description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit",
    // },
];

const CBMCard = () => {
    const [activeStates, setActiveStates] = useState<{ [key: string]: boolean }>(
        EVENTS_CARD_DATA.reduce<{ [key: string]: boolean }>((acc, { title }) => {
            acc[title] = false;
            return acc;
        }, {})
    );

    const handleToggle = (title: string) => {
        setActiveStates((prevStates) => ({
            ...prevStates,
            [title]: !prevStates[title],
        }));
    };

    return (
        <div className="tw-col-span-1 tw-my-5">
            <Card className="tw-border tw-border-blue-gray-100 tw-shadow-lg ">
                <CardHeader floated={false} shadow={false} color="transparent">
                    <Typography className="!tw-font-bold tw-text-lg tw-my-4" color="blue-gray">
                        Condition-Based Maintenance
                    </Typography>
                </CardHeader>
                <CardBody className="!tw-p-0">
                    <div className="tw-flex tw-flex-col space-y-4">
                        {EVENTS_CARD_DATA.map(({ icon, title, description }) => (
                            <div
                                key={title}
                                className="tw-flex tw-items-center tw-justify-between tw-px-4 tw-py-3 tw-border tw-border-gray-200 "
                            >
                                <div className="tw-flex tw-items-center">
                                    <div className="tw-rounded-lg tw-bg-gradient-to-tr tw-from-gray-900 tw-to-gray-800 tw-p-4 tw-shadow">
                                        {React.createElement(icon, {
                                            className: "tw-h-6 tw-w-6 tw-text-white",
                                        })}
                                    </div>
                                    <div className="tw-ml-3">
                                        <Typography
                                            variant="small"
                                            className="!tw-font-semibold tw-text-gray-800"
                                        >
                                            {title}
                                        </Typography>
                                        <Typography
                                            variant="small"
                                            className="!tw-font-normal tw-text-blue-gray-600"
                                        >
                                            {description}
                                        </Typography>
                                    </div>
                                </div>
                                <div className="tw-flex tw-items-center space-x-2">
                                    <Typography variant="small" className="tw-text-sm tw-text-blue-gray-600">
                                        {activeStates[title] ? "Active" : "Inactive"}
                                    </Typography>
                                    <div className="tw-ml-3">
                                        <Switch
                                        checked={activeStates[title]}
                                        onChange={() => handleToggle(title)}
                                    />
                                    </div>
                                    
                                </div>
                            </div>
                        ))}
                    </div>
                </CardBody>
            </Card>
        </div>
    );
};

export default CBMCard;
