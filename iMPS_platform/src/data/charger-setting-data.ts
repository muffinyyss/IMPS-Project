export type SettingItem = {
  title: string;
  value: string;
  unit?: string;
};

export type ChargerSettingSection = {
  section: "Charge Box" | "Control" | "EV" | "Power Module" | "Info";
  items: SettingItem[];
};

export const chargerSettingData: ChargerSettingSection[] = [
  {
    section: "Charge Box",
    items: [{ title: "Charger Box ID", value: "Elex_DC_PT_Wangnoi4_1" }],
  },
  {
    section: "Control",
    items: [
      { title: "Dynamic Max Current", value: "0", unit: "A" },
      { title: "Dynamic Max Power", value: "0", unit: "kW" },
      { title: "Charging Status", value: "Idle" },
    ],
  },
  {
    section: "EV",
    items: [
      { title: "CP State1", value: "A" },
      { title: "CP State2", value: "A" },
      { title: "Target Voltage 1", value: "0.00", unit: "V" },
      { title: "Target Voltage 2", value: "0.00", unit: "V" },
      { title: "Target Current 1", value: "0.00", unit: "A" },
      { title: "Target Current 2", value: "0.00", unit: "A" },
      { title: "SoC1", value: "0", unit: "%" },
      { title: "SoC2", value: "0", unit: "%" },
    ],
  },
  {
    section: "Power Module",
    items: [
      { title: "Measured Voltage 1", value: "0.00", unit: "V" },
      { title: "Measured Voltage 2", value: "0.00", unit: "V" },
      { title: "Max Voltage 1", value: "0.00", unit: "V" },
      { title: "Max Voltage 2", value: "0.00", unit: "V" },
      { title: "Measured Current 1", value: "0.00", unit: "A" },
      { title: "Measured Current 2", value: "0.00", unit: "A" },
      { title: "Max Current 1", value: "0.00", unit: "A" },
      { title: "Max Current 2", value: "0.00", unit: "A" },
      { title: "Power 1", value: "0.00", unit: "W" },
      { title: "Power 2", value: "0.00", unit: "W" },
      { title: "Max Power 1", value: "0.00", unit: "W" },
      { title: "Max Power 2", value: "0.00", unit: "W" },
    ],
  },
  {
    section: "Info",
    items: [
      { title: "IMD Status1", value: "Operative" },
      { title: "IMD Status2", value: "Operative" },
      { title: "PM Status1", value: "Operative" },
      { title: "PM Status2", value: "Operative" },
      { title: "Isolation Status1", value: "fault" },
      { title: "Isolation Status2", value: "fault" },
    ],
  },
];
