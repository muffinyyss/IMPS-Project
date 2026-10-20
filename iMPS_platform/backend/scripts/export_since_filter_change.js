// ดึงข้อมูลของตู้ชาร์จ 1 ตู้ ตั้งแต่วันที่เปลี่ยนแผ่นกรองอากาศ (dust filter) ครั้งล่าสุด → ไฟล์ CSV
// ใช้ได้กับทุก DB ที่ตั้งชื่อ collection ตาม SN เช่น PLC, module2 (module2ChargerDustPrediction)
//
// วิธีใช้:
//   จาก command line (เลือก DB/SN ด้วย --eval ไม่ต้องแก้ไฟล์):
//     mongosh "<MONGO_URI>" --quiet --eval 'var EXPORT_SOURCE="module2"' export_since_filter_change.js
//     mongosh "<MONGO_URI>" --quiet --eval 'var EXPORT_SOURCE="PLC"; var EXPORT_SN="F1500824005"' export_since_filter_change.js
//   ใน mongosh ที่เปิดอยู่:
//     var EXPORT_SOURCE = "module2"; load("/path/to/export_since_filter_change.js")
// ไฟล์ CSV จะถูกสร้างในโฟลเดอร์ที่รัน mongosh อยู่ (สคริปต์จะพิมพ์ path เต็มให้ตอนจบ)
//
// วันเปลี่ยน filter มาจาก PMReport.<SN> → ใบ PM ล่าสุดที่ติ๊ก "เปลี่ยนแผ่นกรอง" (field dust_filter)
// ข้อมูลเลือกตามเวลาใน _id (มี index อยู่แล้ว จึงไม่สแกนทั้ง collection)

(function main() {   // ห่อเป็นฟังก์ชันเพื่อให้ load() ใน mongosh ที่เปิดอยู่จบได้โดยไม่ปิด shell

// ───── ตั้งค่า (ค่าใน --eval / var ก่อน load จะใช้แทนค่า default) ────────────
const SN = typeof EXPORT_SN !== "undefined" ? EXPORT_SN : "F1500824005";
const SOURCE = typeof EXPORT_SOURCE !== "undefined" ? EXPORT_SOURCE : "PLC";
const SINCE_OVERRIDE = typeof EXPORT_SINCE !== "undefined" ? EXPORT_SINCE : null;  // เช่น "2026-08-15" (เวลาไทย) — null = ใช้วันจาก PM Report
const EXPORT = typeof EXPORT_WRITE !== "undefined" ? EXPORT_WRITE : true;          // false = แสดงแค่วันและจำนวนแถว ไม่เขียนไฟล์
const KEEP_EVERY = typeof EXPORT_KEEP_EVERY !== "undefined" ? EXPORT_KEEP_EVERY : 1; // 60 = เอา 1 ใน 60 แถว (ลดขนาดไฟล์)
// ─────────────────────────────────────────────────────────────────────────

// ชื่อย่อ → ชื่อ DB จริง (collection ตั้งชื่อตาม SN ทั้งหมด)
const DB_ALIASES = {
  plc: "PLC",
  setting: "settingParameter",
  utilization: "utilizationFactor",
  cbm: "monitorCBM",
  faultstatus: "FaultStatus",
  module2: "module2ChargerDustPrediction",
  module3: "module3ChargerOfflineAnalysis",
  module4: "module4AbnormalPowerPrediction",
  module5: "module5NetworkProblemPrediction",
  module6: "module6DcChargerRulPrediction",
  module7: "module7ChargerPowerIssue",
};
const dbName = DB_ALIASES[String(SOURCE).toLowerCase()] || SOURCE;

const fs = require("fs");
const path = require("path");

const TH_OFFSET_MS = 7 * 3600 * 1000;
const toThai = (d) => new Date(d.getTime() + TH_OFFSET_MS).toISOString().replace("T", " ").slice(0, 19);
const thaiMidnight = (ymd) => new Date(`${ymd}T00:00:00+07:00`);

function changedFilters(df) {
  if (df === true) return ["(yes)"];
  if (typeof df === "string") return df.trim().toLowerCase() === "yes" ? ["(yes)"] : [];
  if (df && typeof df === "object") {
    return Object.entries(df).filter(([, v]) => v === true || v === "yes").map(([k]) => k);
  }
  return [];
}

function pmStart(doc) {
  const s = String(doc.pm_date || (doc.job && doc.job.date) || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return thaiMidnight(s);
  if (doc.timestamp instanceof Date) return doc.timestamp;
  return doc._id.getTimestamp();
}

print(`แหล่งข้อมูล: ${dbName}.${SN}`);

// ───── 1) หาวันเปลี่ยน filter ล่าสุด ─────────────────────────────────────
let since;
if (SINCE_OVERRIDE) {
  since = thaiMidnight(SINCE_OVERRIDE);
  print(`ใช้วันเริ่มที่กำหนดเอง: ${SINCE_OVERRIDE}`);
} else {
  const pmDocs = db.getSiblingDB("PMReport").getCollection(SN)
    .find({ dust_filter: { $exists: true, $ne: null } },
          { pm_date: 1, "job.date": 1, dust_filter: 1, status: 1, doc_name: 1, issue_id: 1, timestamp: 1 })
    .toArray()
    .filter((d) => changedFilters(d.dust_filter).length > 0)
    .sort((a, b) => pmStart(b) - pmStart(a));

  if (pmDocs.length === 0) {
    print(`ไม่พบใบ PM ของ ${SN} ที่บันทึกการเปลี่ยนแผ่นกรอง — กำหนดวันเองด้วย EXPORT_SINCE แล้วรันใหม่`);
    return;
  }
  const pm = pmDocs[0];
  since = pmStart(pm);
  print(`ใบ PM ที่เปลี่ยน filter ล่าสุด: ${pm.doc_name || pm.issue_id || pm._id}`);
  print(`  pm_date = ${pm.pm_date || (pm.job && pm.job.date) || "-"}   status = ${pm.status || "-"}`);
  print(`  แผ่นกรองที่เปลี่ยน: ${changedFilters(pm.dust_filter).join(", ")}`);
  if (pmDocs.length > 1) {
    print(`  (ครั้งก่อนหน้า: ${pmDocs.slice(1, 4).map((d) => d.pm_date || toThai(pmStart(d)).slice(0, 10)).join(", ")})`);
  }
}
print(`เริ่มดึงข้อมูลตั้งแต่ ${toThai(since)} (เวลาไทย)`);

// ───── 2) นับแถว ─────────────────────────────────────────────────────────
const coll = db.getSiblingDB(dbName).getCollection(SN);
const query = { _id: { $gte: ObjectId.createFromTime(Math.floor(since.getTime() / 1000)) } };
const total = coll.countDocuments(query);
print(`พบข้อมูล ${total.toLocaleString()} แถว` +
      (KEEP_EVERY > 1 ? ` → จะเขียน ~${Math.ceil(total / KEEP_EVERY).toLocaleString()} แถว (1 ใน ${KEEP_EVERY})` : ""));
if (total === 0) {
  print(`ไม่มีข้อมูล — ตรวจชื่อ DB/SN ด้วย: db.getSiblingDB("${dbName}").getCollectionNames()`);
  return;
}
if (Math.ceil(total / KEEP_EVERY) > 1048575) {
  print("⚠ เกิน 1,048,576 แถวที่ Excel เปิดได้ — ถ้าจะเปิดใน Excel ให้ตั้ง EXPORT_KEEP_EVERY ให้มากขึ้น");
}
if (!EXPORT) return;

// ───── 3) สร้างหัวคอลัมน์จากตัวอย่างต้น-ท้ายช่วง ─────────────────────────
const columns = [];
const addKeys = (doc) => Object.keys(doc).forEach((k) => { if (k !== "_id" && !columns.includes(k)) columns.push(k); });
coll.find(query).sort({ _id: 1 }).limit(500).forEach(addKeys);
coll.find(query).sort({ _id: -1 }).limit(500).forEach(addKeys);
const header = ["datetime_th", ...columns];

function cell(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") v = v._bsontype ? v.toString() : JSON.stringify(v);   // ObjectId/Long/Decimal128 → ข้อความ
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ───── 4) เขียน CSV ─────────────────────────────────────────────────────
const shortName = Object.keys(DB_ALIASES).find((k) => DB_ALIASES[k] === dbName) || dbName;
const outFile = path.resolve(`${shortName}_${SN}_since_${toThai(since).slice(0, 10)}.csv`);
const fd = fs.openSync(outFile, "w");
fs.writeSync(fd, "﻿" + header.join(",") + "\n");   // BOM ให้ Excel อ่านภาษาไทยถูก

let buf = [], seen = 0, written = 0;
const flush = () => { if (buf.length) { fs.writeSync(fd, buf.join("\n") + "\n"); buf = []; } };

coll.find(query).sort({ _id: 1 }).batchSize(5000).forEach((doc) => {
  if (seen++ % KEEP_EVERY !== 0) return;
  const t = doc.timestamp_utc instanceof Date ? doc.timestamp_utc : doc._id.getTimestamp();
  buf.push([toThai(t), ...columns.map((c) => cell(doc[c]))].join(","));
  written++;
  if (buf.length >= 5000) flush();
  if (written % 100000 === 0) print(`  ... ${written.toLocaleString()} แถว`);
});
flush();
fs.closeSync(fd);

print(`เสร็จแล้ว: ${written.toLocaleString()} แถว, ${columns.length + 1} คอลัมน์`);
print(`ไฟล์: ${outFile}`);
})();
