// Map ICAO airline codes (3 letters) to their telephony name. Limited to the
// airlines the MVP traffic generator emits; unknowns fall back to NATO
// letter-by-letter.
const AIRLINE_TELEPHONY: Record<string, string> = {
  AAL: "American",
  DAL: "Delta",
  UAL: "United",
  SWA: "Southwest",
  JBU: "JetBlue",
  FFT: "Frontier",
  SKW: "Skywest",
  ENY: "Envoy",
  GJS: "Gojet",
  AAY: "Allegiant",
};

const NATO: Record<string, string> = {
  A: "Alpha", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo",
  F: "Foxtrot", G: "Golf", H: "Hotel", I: "India", J: "Juliet",
  K: "Kilo", L: "Lima", M: "Mike", N: "November", O: "Oscar",
  P: "Papa", Q: "Quebec", R: "Romeo", S: "Sierra", T: "Tango",
  U: "Uniform", V: "Victor", W: "Whiskey", X: "Xray", Y: "Yankee",
  Z: "Zulu",
};

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const TEENS = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

export function icaoToSpoken(callsign: string): string {
  const trimmed = callsign.trim().toUpperCase();
  const match = trimmed.match(/^([A-Z]*)(\d*)$/);
  if (!match) return trimmed;
  const [, letters, digits] = match;
  const letterLen = letters?.length ?? 0;
  const digitLen = digits?.length ?? 0;
  if (letterLen === 0 && digitLen === 0) return trimmed;
  const letterPart = speakLetters(letters ?? "");
  if (digitLen === 0) return letterPart;
  // No carrier letters → speak digits one at a time (default ATC convention).
  const digitPart = letterLen === 0
    ? [...(digits ?? "")].map((d) => ONES[Number(d)]!).join(" ")
    : speakFlightNumber(digits ?? "");
  return letterPart.length === 0 ? digitPart : `${letterPart} ${digitPart}`;
}

function speakLetters(letters: string): string {
  if (letters.length === 0) return "";
  const carrier = AIRLINE_TELEPHONY[letters];
  if (carrier) return carrier;
  return [...letters].map((c) => NATO[c] ?? c).join(" ");
}

function speakFlightNumber(digits: string): string {
  // ATC convention: 1-2 digit flights spoken normally; 3-digit grouped as
  // single + pair (e.g. 891 -> "eight ninety one"); 4-digit grouped as two
  // pairs (e.g. 1234 -> "twelve thirty four"). Trailing pair "00" reads as
  // "hundred"; "000" reads as "thousand" — but neither is reachable from the
  // MVP traffic generator (we use 1-4 digit non-zero-padded flight numbers),
  // so we don't special-case them.
  if (digits.length === 1) return ONES[Number(digits)]!;
  if (digits.length === 2) return speakTwo(digits);
  if (digits.length === 3) {
    const first = ONES[Number(digits[0])]!;
    return `${first} ${speakTwo(digits.slice(1))}`;
  }
  if (digits.length === 4) {
    return `${speakTwo(digits.slice(0, 2))} ${speakTwo(digits.slice(2))}`;
  }
  // 5+ digits: speak each digit. Not realistic, but graceful.
  return [...digits].map((d) => ONES[Number(d)]!).join(" ");
}

function speakTwo(digits: string): string {
  const n = Number(digits);
  if (n < 10) return ONES[n]!;
  if (n < 20) return TEENS[n - 10]!;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones === 0 ? TENS[tens]! : `${TENS[tens]!} ${ONES[ones]!}`;
}
