import dynamic from "next/dynamic";

// @material-tailwind/react
import {
    Typography,
    Card,
    CardHeader,
    CardBody,
} from "@/components/MaterialTailwind";

// @components
import LightCard from "./components/light-card";


export default function SalesPage() {
    return (
        <div className="tw-mt-8 tw-mb-4">

            {/** Horizontal Bar Chart */}
            <div className="tw-mt-6 tw-grid tw-grid-cols-1 tw-gap-y-6 lg:tw-gap-6">
                <LightCard />
            </div>
        </div>
    );
}
