import { describe, expect, it } from "vitest";
import {
  GLOSSARY_SIZE,
  checkGlossary,
  detectEntryIds,
  normalizeText,
} from "./glossary";

const ids = (warnings: { id: string }[]) => warnings.map((w) => w.id).sort();

describe("glossary size", () => {
  it("has between 40 and 60 starter entries", () => {
    expect(GLOSSARY_SIZE).toBeGreaterThanOrEqual(40);
    expect(GLOSSARY_SIZE).toBeLessThanOrEqual(60);
  });
});

describe("normalizeText", () => {
  it("strips Arabic diacritics and tatweel", () => {
    expect(normalizeText("الصَّلَاةَ")).toBe(normalizeText("الصلاة"));
    expect(normalizeText("صـلاة")).toBe(normalizeText("صلاة"));
  });

  it("folds Persian and Urdu letter variants onto Arabic ones", () => {
    expect(normalizeText("زکات")).toBe(normalizeText("زكات"));
    expect(normalizeText("نیت")).toBe(normalizeText("نيت"));
  });

  it("strips Latin diacritics and Turkish dotless i", () => {
    expect(normalizeText("Salât")).toBe("salat");
    expect(normalizeText("SABIR")).toBe("sabir");
  });
});

describe("checkGlossary", () => {
  it("reports nothing when the accepted rendering is present", () => {
    const warnings = checkGlossary({
      source: "Prayer is a pillar of faith",
      draft: "الصلاة ركن من أركان الإيمان",
      sourceLang: "en",
      targetLang: "ar",
    });
    expect(warnings).toEqual([]);
  });

  it("reports a miss with the accepted renderings", () => {
    const warnings = checkGlossary({
      source: "Prayer is a pillar of faith",
      draft: "العبادة ركن من أركان الدين",
      sourceLang: "en",
      targetLang: "ar",
    });
    expect(ids(warnings)).toEqual(["iman", "salah"]);
    const salah = warnings.find((w) => w.id === "salah");
    expect(salah?.term).toBe("prayer");
    expect(salah?.expected).toContain("صلاة");
  });

  it("only reports the terms that are actually missing", () => {
    const warnings = checkGlossary({
      source: "Zakat and prayer",
      draft: "الزكاة",
      sourceLang: "en",
      targetLang: "ar",
    });
    expect(ids(warnings)).toEqual(["salah"]);
  });

  it("matches Arabic terms through prefixes and diacritics", () => {
    const warnings = checkGlossary({
      source: "وأقيموا الصَّلَاةَ وآتوا الزَّكَاةَ",
      draft: "Perform prayer and give zakat",
      sourceLang: "ar",
      targetLang: "en",
    });
    expect(warnings).toEqual([]);
  });

  it("accepts diacritics in the draft", () => {
    const warnings = checkGlossary({
      source: "Prayer",
      draft: "الصَّلَاة",
      sourceLang: "en",
      targetLang: "ar",
    });
    expect(warnings).toEqual([]);
  });

  it("matches Urdu orthography against an Arabic rendering", () => {
    const warnings = checkGlossary({
      source: "زکوٰۃ مال کو پاک کرتی ہے",
      draft: "الزكاة تطهر المال",
      sourceLang: "ur",
      targetLang: "ar",
    });
    expect(warnings).toEqual([]);
  });

  it("matches Turkish suffixed forms", () => {
    const warnings = checkGlossary({
      source: "Namazı kılmak farzdır",
      draft: "Establishing prayer is obligatory",
      sourceLang: "tr",
      targetLang: "en",
    });
    expect(warnings).toEqual([]);
  });

  it("returns nothing when the source has no glossary terms", () => {
    expect(
      checkGlossary({ source: "The weather is nice", draft: "الطقس جميل", sourceLang: "en", targetLang: "ar" }),
    ).toEqual([]);
  });
});

describe("detectEntryIds", () => {
  it("does not match a term inside a longer unrelated word", () => {
    expect(detectEntryIds("Hello there", "en")).not.toContain("jahannam");
    expect(detectEntryIds("Hell is far", "en")).toContain("jahannam");
  });

  it("does not match Arabic look-alike words", () => {
    expect(detectEntryIds("الحجر الأسود", "ar")).not.toContain("hajj");
    expect(detectEntryIds("الحج فريضة", "ar")).toContain("hajj");
  });

  it("matches English inflections", () => {
    expect(detectEntryIds("Angels are messengers", "en")).toEqual(
      expect.arrayContaining(["angels", "messenger"]),
    );
  });
});
