const MONTHS = [
  "जनवरी",
  "फरवरी",
  "मार्च",
  "अप्रैल",
  "मई",
  "जून",
  "जुलाई",
  "अगस्त",
  "सितंबर",
  "अक्टूबर",
  "नवंबर",
  "दिसंबर",
];

// "2026-10-08" -> "8 अक्टूबर 2026"
export function formatBhojpuriDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) throw new Error(`Invalid ISO date: ${iso}`);
  const [, y, mo, d] = m;
  return `${Number(d)} ${MONTHS[Number(mo) - 1]} ${y}`;
}

// "2026-10-08" -> "2026-10-08T00:00:00Z"
export function toAtomDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) {
    throw new Error(`Invalid ISO date: ${iso}`);
  }
  return `${iso}T00:00:00Z`;
}
