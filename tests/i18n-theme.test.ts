import { describe, expect, it } from "vitest";
import { DICTIONARY, t } from "@/lib/i18n";

describe("i18n dictionary & locale support", () => {
  it("provides English defaults for all navigation and loss report keys", () => {
    expect(t("appName", "en")).toBe("CodBooks");
    expect(t("settlementHealth", "en")).toBe("Settlement Health");
    expect(t("aging", "en")).toBe("Aging");
    expect(t("lossReport", "en")).toBe("Loss Report");
    expect(t("uploads", "en")).toBe("Uploads");
    expect(t("matches", "en")).toBe("Matches");
    expect(t("exports", "en")).toBe("Exports");
    expect(t("audit", "en")).toBe("Audit");
    expect(t("team", "en")).toBe("Team");
  });

  it("provides authentic Urdu translations for all keys", () => {
    expect(t("appName", "ur")).toBe("کوڈ بکس");
    expect(t("settlementHealth", "ur")).toBe("سیٹلمنٹ صورتحال");
    expect(t("aging", "ur")).toBe("بقایا جات کی مدت");
    expect(t("lossReport", "ur")).toBe("نقصان اور تنازعات");
    expect(t("uploads", "ur")).toBe("فائل اپ لوڈ");
    expect(t("matches", "ur")).toBe("میچنگ ریکارڈ");
    expect(t("exports", "ur")).toBe("ڈیٹا برآمد");
    expect(t("audit", "ur")).toBe("آڈٹ لاگ");
    expect(t("team", "ur")).toBe("ٹیم");
  });

  it("falls back to English when a translation key is missing in Urdu", () => {
    expect(t("appName", "ur")).toBeTruthy();
    // @ts-expect-error test fallback
    expect(t("non_existent_key", "ur")).toBe("non_existent_key");
  });

  it("has parity between English and Urdu dictionary key sets", () => {
    const enKeys = Object.keys(DICTIONARY.en).sort();
    const urKeys = Object.keys(DICTIONARY.ur).sort();
    expect(urKeys).toEqual(enKeys);
  });
});
