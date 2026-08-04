// Référentiel Maximo « Failure Code » (IESB_MxLoader_Failure Code v1.0).
// Généré depuis la feuille "Failure Code" du classeur fourni par l'équipe Maximo —
// colonnes FAILURECODE / PROBLEM CODE / CAUSE CODE / REMEDY CODE / REMEDY DESCRIPTION.
// Sert au CM dashboard pour traduire les codes stockés en libellés lisibles.
// Un seul correctif éditorial : "RebootController No.2)" → "Reboot (Controller No.2)".

/** [failureCode, problemCode, causeCode, remedyCode, remedyDescription] */
export const FAILURE_CODE_ROWS: readonly (readonly [string, string, string, string, string])[] = [
  ["DCCHARFC", "POWERDRP", "OVERHEAT", "REPLACE", "Replace (Filter)"],
  ["DCCHARFC", "POWERDRP", "POWMODUL", "REPLACE", "Replace (Power Module)"],
  ["DCCHARFC", "POWERDRP", "PMCMFAIL", "REPLACE", "Replace (Power Module)"],
  ["DCCHARFC", "POWERDRP", "PMCMFAIL", "RECHECK", "Recheck (Power Module)"],
  ["DCCHARFC", "POWERDRP", "PMCMFAIL", "REPAIR", "Repair (Power Module)"],
  ["DCCHARFC", "POWERDRP", "POWSUPPL", "REPLACE", "Replace (Power Supply)"],
  ["DCCHARFC", "POWERDRP", "CBPOWTRP", "REPLACE", "Replace (CB)"],
  ["DCCHARFC", "POWERDRP", "CBPOWTRP", "RESET", "Reset (CB)"],
  ["DCCHARFC", "POWERDRP", "RCDPROTS", "REPLACE", "Replace (RCD)"],
  ["DCCHARFC", "POWERDRP", "RCDPROTS", "RESET", "Reset (RCD)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR1FC", "REPLACE", "Replace (DC Contactor No.1)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR2FC", "REPLACE", "Replace (DC Contactor No.2)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR3FC", "REPLACE", "Replace (DC Contactor No.3)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR4FC", "REPLACE", "Replace (DC Contactor No.4)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR5FC", "REPLACE", "Replace (DC Contactor No.5)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR6FC", "REPLACE", "Replace (DC Contactor No.6)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR1FC", "RECHECK", "Recheck (DC Contactor No.1)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR2FC", "RECHECK", "Recheck (DC Contactor No.2)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR3FC", "RECHECK", "Recheck (DC Contactor No.3)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR4FC", "RECHECK", "Recheck (DC Contactor No.4)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR5FC", "RECHECK", "Recheck (DC Contactor No.5)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR6FC", "RECHECK", "Recheck (DC Contactor No.6)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR1FC", "REPAIR", "Repair (DC Contactor No.1)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR2FC", "REPAIR", "Repair (DC Contactor No.2)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR3FC", "REPAIR", "Repair (DC Contactor No.3)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR4FC", "REPAIR", "Repair (DC Contactor No.4)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR5FC", "REPAIR", "Repair (DC Contactor No.5)"],
  ["DCCHARFC", "UN2STCHG", "DCCTR6FC", "REPAIR", "Repair (DC Contactor No.6)"],
  ["DCCHARFC", "UN2STCHG", "ACCTR1FC", "REPLACE", "Replace (AC Contactor No.1)"],
  ["DCCHARFC", "UN2STCHG", "ACCTR2FC", "REPLACE", "Replace (AC Contactor No.2)"],
  ["DCCHARFC", "UN2STCHG", "ACCTR3FC", "REPLACE", "Replace (AC Contactor No.3)"],
  ["DCCHARFC", "UN2STCHG", "ACCTR1FC", "RECHECK", "Recheck (AC Contactor No.1)"],
  ["DCCHARFC", "UN2STCHG", "ACCTR2FC", "RECHECK", "Recheck (AC Contactor No.2)"],
  ["DCCHARFC", "UN2STCHG", "ACCTR3FC", "RECHECK", "Recheck (AC Contactor No.3)"],
  ["DCCHARFC", "UN2STCHG", "ACCTR1FC", "REPAIR", "Repair (AC Contactor No.1)"],
  ["DCCHARFC", "UN2STCHG", "ACCTR2FC", "REPAIR", "Repair (AC Contactor No.2)"],
  ["DCCHARFC", "UN2STCHG", "ACCTR3FC", "REPAIR", "Repair (AC Contactor No.3)"],
  ["DCCHARFC", "UN2STCHG", "IMD1FC", "REPLACE", "Replace (Insulation Monitoring Divce Fail No.1)"],
  ["DCCHARFC", "UN2STCHG", "IMD2FC", "REPLACE", "Replace (Insulation Monitoring Divce Fail No.2)"],
  ["DCCHARFC", "UN2STCHG", "IMD1FC", "RECHECK", "Recheck (Insulation Monitoring Divce Fail No.1)"],
  ["DCCHARFC", "UN2STCHG", "IMD2FC", "RECHECK", "Recheck (Insulation Monitoring Divce Fail No.2)"],
  ["DCCHARFC", "UN2STCHG", "IMD1FC", "REPAIR", "Repair (Insulation Monitoring Divce Fail No.1)"],
  ["DCCHARFC", "UN2STCHG", "IMD2FC", "REPAIR", "Repair (Insulation Monitoring Divce Fail No.2)"],
  ["DCCHARFC", "UN2STCHG", "CTL1FC", "REPLACE", "Replace (Controller No.1)"],
  ["DCCHARFC", "UN2STCHG", "CTL2FC", "REPLACE", "Replace (Controller No.2)"],
  ["DCCHARFC", "UN2STCHG", "CTL1FC", "RECHECK", "Recheck (Controller No.1)"],
  ["DCCHARFC", "UN2STCHG", "CTL2FC", "RECHECK", "Recheck (Controller No.2)"],
  ["DCCHARFC", "UN2STCHG", "CTL1FC", "REPAIR", "Repair (Controller No.1)"],
  ["DCCHARFC", "UN2STCHG", "CTL2FC", "REPAIR", "Repair (Controller No.2)"],
  ["DCCHARFC", "UN2STCHG", "CTL1FC", "REBOOT", "Reboot (Controller No.1)"],
  ["DCCHARFC", "UN2STCHG", "CTL2FC", "REBOOT", "Reboot (Controller No.2)"],
  ["DCCHARFC", "UN2STCHG", "CCD1FC", "REPLACE", "Replace (Charging Cable No.1)"],
  ["DCCHARFC", "UN2STCHG", "CCD2FC", "REPLACE", "Replace (Charging Cable No.2)"],
  ["DCCHARFC", "UN2STCHG", "LIRFC", "REPAIR", "Repair Internal Insulation Fault"],
  ["DCCHARFC", "UN2STCHG", "EMERBUTP", "RESET", "Reset (Emergency)"],
  ["DCCHARFC", "UN2STCHG", "CPCB1MISS", "REPLACE", "Replace (Charging Cable No.1)"],
  ["DCCHARFC", "UN2STCHG", "CPCB2MISS", "REPLACE", "Replace (Charging Cable No.2)"],
  ["DCCHARFC", "SCRFREEZ", "OVERHEAT", "REPLACE", "Replace (Filter)"],
  ["DCCHARFC", "NOINTSIG", "SIMCARDP", "REPLACE", "Replace (SIM)"],
  ["DCCHARFC", "NOINTSIG", "CHSTARTC", "REPLACE", "Replace (SIM)"],
  ["DCCHARFC", "NOINTSIG", "CHSTOPTC", "REPLACE", "Replace (SIM)"],
  ["DCCHARFC", "NOINTSIG", "DISCONFR", "REPLACE", "Replace (SIM)"],
  ["DCCHARFC", "NOINTSIG", "DISCONFR", "REPLACE", "Replace (Router)"],
  ["DCCHARFC", "DATATRAN", "CONBOANC", "RECHECK", "Recheck (Cable)"],
  ["DCCHARFC", "HMISCREE", "HMISCROF", "REPLACE", "Replace (HMI Touch Screen Board)"],
  ["DCCHARFC", "HMISCREE", "HMISCROF", "RECHECK", "Recheck (HMI Touch Screen Board)"],
  ["DCCHARFC", "HMISCREE", "HMISCROF", "REPAIR", "Repair (HMI Touch Screen Board)"],
  ["DCCHARFC", "HMISCREE", "HMISCROF", "REBOOT", "Reboot (HMI Touch Screen Board)"],
  ["DCCHARFC", "CONBOARD", "CONBOAFA", "REPLACE", "Replace (Control Board)"],
  ["DCCHARFC", "CONBOARD", "CONBOAFA", "UPDATEFW", "Update Firmware"],
  ["DCCHARFC", "BILLINGU", "CONBOAFA", "RESTORE", "Restore Charger"],
  ["DCCHARFC", "BILLINGU", "CONBOAFA", "REPLACE", "Replace (Control Board)"],
  ["DCCHARFC", "BILLINGU", "CONBOAFA", "RESTORE", "Restore Charger"],
  ["DCCHARFC", "BILLINGU", "CONBOAFA", "REPLACE", "Replace (Power Meter)"],
  ["DCCHARFC", "BILLINGU", "CONBOAFA", "RESTORE", "Restore (Power Meter)"],
  ["DCCHARFC", "NOCONSTD", "PECUTFAI", "NOTIFYMF", "Notify the Manufacturer"],
  ["DCCHARFC", "NOCONSTD", "CPSHTFAI", "NOTIFYMF", "Notify the Manufacturer"],
  ["ACCHARFC", "POWERDRP", "POWBOAFA", "REPLACE", "Replace (Power Board)"],
  ["ACCHARFC", "UN2STCHG", "EMERBUTP", "RESET", "Reset (Emergency)"],
  ["ACCHARFC", "UN2STCHG", "CPCBMISS", "REPLACE", "Replace (Charging Cable)"],
  ["ACCHARFC", "SCRFREEZ", "OVERHEAT", "REBOOT", "Reboot (Charger)"],
  ["ACCHARFC", "NOINTSIG", "SIMCARDP", "REPLACE", "Replace (SIM)"],
  ["ACCHARFC", "NOINTSIG", "CHSTARTC", "REPLACE", "Replace (SIM)"],
  ["ACCHARFC", "NOINTSIG", "CHSTOPTC", "REPLACE", "Replace (SIM)"],
  ["ACCHARFC", "NOINTSIG", "DISCONFR", "REPLACE", "Replace (SIM)"],
  ["ACCHARFC", "NOINTSIG", "DISCONFR", "REPLACE", "Replace (Router)"],
  ["ACCHARFC", "DATATRAN", "CONBOANC", "RECHECK", "Recheck (Cable)"],
  ["ACCHARFC", "HMISCREE", "HMISCROF", "REPLACE", "Replace (HMI Touch Screen Board)"],
  ["ACCHARFC", "CONBOARD", "CONBOAFA", "REPLACE", "Replace (Control Board)"],
  ["ACCHARFC", "CONBOARD", "CONBOAFA", "UPDATEFW", "Update Firmware"],
  ["ACCHARFC", "BILLINGU", "CONBOAFA", "RESTORE", "Restore Charger"],
  ["ACCHARFC", "BILLINGU", "CONBOAFA", "REPLACE", "Replace (Control Board)"],
  ["STATFC", "HVPROBLM", "HVFUSEDR", "REPLACE", "Replace (HV Fuse)"],
  ["STATFC", "HVPROBLM", "GROUNDIN", "FIX", "Fix (Grounding)"],
  ["STATFC", "HVPROBLM", "MCBTRIPF", "RESET", "Reset (MCB)"],
  ["STATFC", "HVPROBLM", "MCBTRIPF", "REPLACE", "Replace (MCB)"],
  ["STATFC", "HVPROBLM", "FUSELAMP", "REPLACE", "Replace (Fuse or Lamp)"],
  ["STATFC", "EVDBPROB", "CUBUSBAR", "REPLACE", "Replace (Busbar)"],
  ["STATFC", "EVDBPROB", "WATERENT", "FIX", "Fix (Sealing)"],
  ["STATFC", "EVDBPROB", "MCCBTRIP", "RESET", "Reset (MCCB)"],
  ["STATFC", "EVDBPROB", "MCCBTRIP", "REPLACE", "Replace (MCCB)"],
  ["STATFC", "EVDBPROB", "MCBTRIPF", "RESET", "Reset (MCB)"],
  ["STATFC", "EVDBPROB", "MCBTRIPF", "REPLACE", "Replace (MCB)"],
  ["STATFC", "EVDBPROB", "RCDTRIPF", "RESET", "Reset (RCD)"],
  ["STATFC", "EVDBPROB", "RCDTRIPF", "REPLACE", "Replace (RCD)"],
  ["STATFC", "POWERMET", "METERFAI", "REPLACE", "Replace (Power Meter)"],
  ["STATFC", "POWERMET", "METERFAI", "REPLACE", "Replace (CT)"],
  ["STATFC", "FUSEPROB", "FUSESURG", "REPLACE", "Replace (Fuse)"],
  ["STATFC", "FUSEPROB", "FUSEPHAS", "REPLACE", "Replace (Fuse)"],
  ["STATFC", "FUSEPROB", "FUSELAMP", "REPLACE", "Replace (Fuse or Lamp)"],
  ["STATFC", "PHPROTPB", "PHASEALT", "FIX", "Fix (Phase Sequence)"],
  ["STATFC", "PHPROTPB", "OVERVOLT", "RECHECK", "Recheck (Voltage)"],
  ["STATFC", "PHPROTPB", "OVERVOLT", "ADJUST", "Adjust (Protection Setting)"],
  ["STATFC", "PHPROTPB", "UNDEVOLT", "RECHECK", "Recheck (Voltage)"],
  ["STATFC", "PHPROTPB", "UNDEVOLT", "ADJUST", "Adjust (Protection Setting)"],
  ["STATFC", "PHPROTPB", "INCVMISS", "RECHECK", "Recheck (Voltage)"],
  ["STATFC", "RELAYPRO", "RELAYFAI", "REPLACE", "Replace (Relay)"],
  ["STATFC", "FANPROBL", "EXHTFANF", "REPLACE", "Replace (Fan)"],
  ["STATFC", "ROUTERPB", "ROUTFAIL", "REPLACE", "Replace (Router)"],
  ["STATFC", "ROUTERPB", "ROUTFAIL", "REBOOT", "Reboot (Router)"],
  ["STATFC", "UPSSBPOB", "UPSFAILU", "REPLACE", "Replace (UPS)"],
  ["STATFC", "NVRPROBL", "NVRFAILE", "REPLACE", "Replace (NVR)"],
  ["STATFC", "CCTVPROB", "CCTVFAIL", "REPLACE", "Replace (CCTV)"],
  ["STATFC", "QRCDPROB", "QRCDFAIL", "REPLACE", "Replace (QR Code)"],
  ["STATFC", "LIGTPROB", "LIGTFAIL", "REPLACE", "Replace (Lighting)"],
  ["STATFC", "PARKPROB", "PRKPAINT", "FIX", "Fix (Floor)"],
  ["STATFC", "STRUPROB", "STRUDAMA", "FIX", "Fix (Structure)"],
  ["STATFC", "FIREEXPB", "GUAGUNOV", "REPLACE", "Replace (Fire Extinguisher)"],
];

/** CAUSE CODE → CAUSE DESCRIPTION */
export const CAUSE_DESCRIPTIONS: Record<string, string> = {
  "OVERHEAT": "Overheat",
  "POWMODUL": "Power Module Failed",
  "PMCMFAIL": "Power Module Communication Fail",
  "POWSUPPL": "Power Supply AC-DC 24Vdc Failed (Fan)",
  "CBPOWTRP": "CB Power Module Trip",
  "RCDPROTS": "RCD Leakage Protection System (Charger)",
  "DCCTR1FC": "DC Contactor No.1 Fail",
  "DCCTR2FC": "DC Contactor No.2 Fail",
  "DCCTR3FC": "DC Contactor No.3 Fail",
  "DCCTR4FC": "DC Contactor No.4 Fail",
  "DCCTR5FC": "DC Contactor No.5 Fail",
  "DCCTR6FC": "DC Contactor No.6 Fail",
  "ACCTR1FC": "AC Contactor No.1 Fail",
  "ACCTR2FC": "AC Contactor No.2 Fail",
  "ACCTR3FC": "AC Contactor No.3 Fail",
  "IMD1FC": "Insulation Monitoring Divce Fail No.1",
  "IMD2FC": "Insulation Monitoring Divce Fail No.2",
  "CTL1FC": "Controller Fail No.1",
  "CTL2FC": "Controller Fail No.2",
  "CCD1FC": "Charging Cable Damage No.1",
  "CCD2FC": "Charging Cable Damage No.2",
  "LIRFC": "Low Internal Insulation Resistance",
  "EMERBUTP": "Emergency Button Pressed",
  "CPCB1MISS": "CP Cable is Missing No.1",
  "CPCB2MISS": "CP Cable is Missing No.2",
  "SIMCARDP": "SIM Card Problem",
  "CHSTARTC": "Charger Does Not Send StartTransaction",
  "CHSTOPTC": "Charger Does Not Send StopTransaction",
  "DISCONFR": "Disconnect Frequently",
  "CONBOANC": "Control Board Cable is Not Connected",
  "HMISCROF": "Touch Screen Off",
  "CONBOAFA": "Control Board Failed",
  "PECUTFAI": "PE Cut Test Failed",
  "CPSHTFAI": "CP Short Test Failed",
  "POWBOAFA": "Power Board Failed",
  "CPCBMISS": "CP Cable is Missing",
  "HVFUSEDR": "HV Fuse Drop",
  "GROUNDIN": "Grounding",
  "MCBTRIPF": "MCB Trip",
  "FUSELAMP": "Fuse or Pilot Lamp",
  "CUBUSBAR": "Copper Busbar Burnt",
  "WATERENT": "There is Water Entering.",
  "MCCBTRIP": "MCCB Trip",
  "RCDTRIPF": "RCD Trip",
  "METERFAI": "Power Meter Failed",
  "FUSESURG": "Fuse Surge Protection",
  "FUSEPHAS": "Fuse Phase Protection",
  "PHASEALT": "Phase Alternation",
  "OVERVOLT": "Over Voltage",
  "UNDEVOLT": "Under Voltage",
  "INCVMISS": "Incoming Voltage is Missing",
  "RELAYFAI": "Relay Failed",
  "EXHTFANF": "Exhaust Fan Failed",
  "ROUTFAIL": "Router Failed",
  "UPSFAILU": "UPS Failed",
  "NVRFAILE": "NVR Failed",
  "CCTVFAIL": "CCTV Failed",
  "QRCDFAIL": "QR Code Failed",
  "LIGTFAIL": "Lighting Failed",
  "PRKPAINT": "Peeling Paint",
  "STRUDAMA": "Structure Damaged",
  "GUAGUNOV": "Gauge Undered/Overed"
};

/** PROBLEM CODE → PROBLEM DESCRIPTION */
export const PROBLEM_DESCRIPTIONS: Record<string, string> = {
  "POWERDRP": "Power Drop",
  "UN2STCHG": "Unable to Start Charging",
  "SCRFREEZ": "The Screen Freezes",
  "NOINTSIG": "No Internet Signal",
  "DATATRAN": "Data Transmission",
  "HMISCREE": "HMI Touch Screen",
  "CONBOARD": "Control Board",
  "BILLINGU": "Wrong Billing Unit",
  "NOCONSTD": "Not Conform to Standard",
  "HVPROBLM": "HV Side",
  "EVDBPROB": "EVDB",
  "POWERMET": "Power Meter",
  "FUSEPROB": "Fuse",
  "PHPROTPB": "Phase Protection",
  "RELAYPRO": "Relay",
  "FANPROBL": "Fan",
  "ROUTERPB": "Router",
  "UPSSBPOB": "UPS Supply",
  "NVRPROBL": "NVR",
  "CCTVPROB": "CCTV",
  "QRCDPROB": "QR Code",
  "LIGTPROB": "Station Lighting",
  "PARKPROB": "Parking Space",
  "STRUPROB": "Structure",
  "FIREEXPB": "Fire Extinguisher"
};

/** REMEDY CODE → libellé court (catégories du pie chart) */
export const REMEDY_LABELS: Record<string, string> = {
  "RESTORE": "Restore",
  "REPLACE": "Replace",
  "RECHECK": "Recheck",
  "REPAIR": "Repair",
  "RESET": "Reset",
  "REBOOT": "Reboot",
  "UPDATEFW": "Update Firmware",
  "NOTIFYMF": "Notify the Manufacturer",
  "FIX": "Fix",
  "ADJUST": "Adjust"
};

const norm = (v: string) => (v || "").trim().toUpperCase();

/** Libellé lisible d'un code cause — renvoie la valeur telle quelle si inconnue (données libres anciennes). */
export function causeLabel(code: string): string {
  const v = (code || "").trim();
  if (!v) return "";
  return CAUSE_DESCRIPTIONS[norm(v)] ?? v;
}

/** Libellé lisible d'un code remedy — valeur telle quelle si inconnue. */
export function remedyLabel(code: string): string {
  const v = (code || "").trim();
  if (!v) return "";
  return REMEDY_LABELS[norm(v)] ?? v;
}

// Index "fc:problem:cause:remedy" et "cause:remedy" → REMEDY DESCRIPTION
const DESC_BY_FULL_KEY: Record<string, string> = {};
const DESCS_BY_CAUSE_REMEDY: Record<string, string[]> = {};
const DESCS_BY_REMEDY: Record<string, string[]> = {};
const addTo = (bucket: Record<string, string[]>, key: string, desc: string) => {
  const list = (bucket[key] ||= []);
  if (!list.includes(desc)) list.push(desc);
};
for (const [fc, problem, cause, remedy, desc] of FAILURE_CODE_ROWS) {
  DESC_BY_FULL_KEY[`${fc}:${problem}:${cause}:${remedy}`] = desc;
  addTo(DESCS_BY_CAUSE_REMEDY, `${cause}:${remedy}`, desc);
  addTo(DESCS_BY_REMEDY, remedy, desc);
}

// REMEDY DESCRIPTION → REMEDY CODE (pour recolorer un détail toutes catégories confondues)
const CODE_BY_DESC: Record<string, string> = {};
for (const [, , , remedy, desc] of FAILURE_CODE_ROWS) {
  if (!(desc in CODE_BY_DESC)) CODE_BY_DESC[desc] = remedy;
}
const CODE_BY_SHORT_LABEL: Record<string, string> = {};
for (const [code, label] of Object.entries(REMEDY_LABELS)) CODE_BY_SHORT_LABEL[label] = code;

/** Code remedy d'une description ("Replace (SIM)" → "REPLACE"). "" si introuvable. */
export function remedyCodeOfDescription(description: string): string {
  const d = (description || "").trim();
  if (!d) return "";
  return CODE_BY_DESC[d] ?? CODE_BY_SHORT_LABEL[d] ?? "";
}

/**
 * REMEDY DESCRIPTION(s) correspondant à un remède, dans le contexte d'une fiche CM.
 * Une même fiche peut porter plusieurs causes : on renvoie toutes les descriptions
 * distinctes qui collent au contexte.
 * Ordre de résolution : (fc, problème, cause, remède) → (cause, remède) → libellé court du remède.
 */
export function remedyDescriptions(
  failureCode: string,
  problems: string[],
  causes: string[],
  remedy: string
): string[] {
  const rem = norm(remedy);
  if (!rem) return [];
  const fc = norm(failureCode);
  const out: string[] = [];
  const push = (d: string) => { if (d && !out.includes(d)) out.push(d); };

  for (const c of causes.map(norm).filter(Boolean)) {
    const before = out.length;
    for (const p of problems.map(norm).filter(Boolean)) {
      const d = DESC_BY_FULL_KEY[`${fc}:${p}:${c}:${rem}`];
      if (d) push(d);
    }
    // aucune correspondance exacte pour cette cause → on retombe sur (cause, remède)
    if (out.length === before) for (const d of DESCS_BY_CAUSE_REMEDY[`${c}:${rem}`] || []) push(d);
  }
  if (out.length === 0) {
    const only = DESCS_BY_REMEDY[rem];
    if (only && only.length === 1) push(only[0]);
    else push(remedyLabel(rem));
  }
  return out;
}
