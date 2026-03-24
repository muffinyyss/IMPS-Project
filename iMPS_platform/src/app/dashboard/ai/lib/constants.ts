export interface ModuleConfig {
  key: string;
  num: number;
  label: string;
  labelTh: string;
  color: string;
  colorBg: string;
  icon: string;
  weight: number;
  aiModels: string[];
}

export const MODULES: ModuleConfig[] = [
  { key: "m1", num: 1, label: "MDB Dust Filter",   labelTh: "การตันของฟิลเตอร์ตู้สวิทซ์ประธาน", color: "#059669", colorBg: "rgba(5,150,105,.1)",   icon: "🌀", weight: 0.12, aiModels: ["XGBoost Clf","XGBoost Reg","Autoencoder","Multi-Task DNN","BiLSTM-Attention","1D-CNN","Gradient Boosting","Isolation Forest","LOF","Ensemble"] },
  { key: "m2", num: 2, label: "Charger Filter",    labelTh: "การตันของฟิลเตอร์เครื่องอัดประจุ",  color: "#0891b2", colorBg: "rgba(8,145,178,.1)",  icon: "🔄", weight: 0.12, aiModels: ["XGBoost Reg","XGBoost Clf","Autoencoder","Multi-Task DNN","BiLSTM-Attention","Isolation Forest","LOF"] },
  { key: "m3", num: 3, label: "Charger Offline",   labelTh: "การออฟไลน์ของเครื่องอัดประจุ",      color: "#7c3aed", colorBg: "rgba(124,58,237,.1)", icon: "📡", weight: 0.16, aiModels: ["XGBoost Root Cause","DNN Root Cause","Early Warning","Autoencoder","BiLSTM-Attention","IF+LOF Ensemble"] },
  { key: "m4", num: 4, label: "Abnormal Power",    labelTh: "การจ่ายไฟฟ้าผิดปกติของ Charger",   color: "#d97706", colorBg: "rgba(217,119,6,.1)",  icon: "⚡", weight: 0.20, aiModels: ["Autoencoder","DNN Per-Condition","PerConditionEngine"] },
  { key: "m5", num: 5, label: "Network Problem",   labelTh: "ปัญหาเครือข่ายอินเตอร์เน็ต",        color: "#2563eb", colorBg: "rgba(37,99,235,.1)",  icon: "🌐", weight: 0.12, aiModels: [] },
  { key: "m6", num: 6, label: "RUL Estimation",    labelTh: "อายุที่เหลือของอุปกรณ์ภายในเครื่อง", color: "#dc2626", colorBg: "rgba(220,38,38,.1)",  icon: "⏳", weight: 0.18, aiModels: ["Temperature-Penalty RUL"] },
  { key: "m7", num: 7, label: "EV-PLCC Failure",   labelTh: "วิเคราะห์การทำงานผิดปกติ",           color: "#ec4899", colorBg: "rgba(236,72,153,.1)", icon: "🔍", weight: 0.10, aiModels: ["State Machine Analyzer","EVPLCC Analyzer"] },
];

// ✅ ตรงต้นฉบับ: ≥80=green, ≥60=lime, ≥40=yellow, ≥20=orange, <20=red
export function getHealthColor(value: number | null | undefined): string {
  if (value == null) return "#6b7280";
  if (value >= 80) return "#22c55e";
  if (value >= 60) return "#84cc16";
  if (value >= 40) return "#eab308";
  if (value >= 20) return "#f97316";
  return "#ef4444";
}

export function getHealthLabel(value: number | null | undefined): string {
  if (value == null) return "No Data";
  if (value >= 80) return "Excellent";
  if (value >= 60) return "Good";
  if (value >= 40) return "Fair";
  if (value >= 20) return "Poor";
  return "Critical";
}

export function getHealthGrade(value: number | null | undefined): string {
  if (value == null) return "X";
  if (value >= 80) return "A";
  if (value >= 60) return "B";
  if (value >= 40) return "C";
  if (value >= 20) return "D";
  return "F";
}

// ✅ ตรงต้นฉบับ
export function getStatusClass(health: number | null): "ok" | "warn" | "crit" | "na" {
  if (health == null) return "na";
  if (health >= 75) return "ok";
  if (health >= 50) return "warn";
  return "crit";
}