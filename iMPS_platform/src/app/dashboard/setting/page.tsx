import dynamic from "next/dynamic";

// @material-tailwind/react
import {
  Typography,
  Card,
  CardHeader,
  CardBody,
} from "@/components/MaterialTailwind";

// @components
import ChargerSettingCard from "./components/chargerSetting-card";

export default function ChargerSettingPage() {
  return (
    <div className="tw-mt-8 tw-mb-4">
      <ChargerSettingCard />
    </div>
  );
}
