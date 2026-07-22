import { describe, expect, test } from "bun:test";
import { decodesAsQr, logoShaped, trimWhiteBorders } from "../fetch-thumbs";
import sharp from "sharp";

describe("logoShaped candidate ordering", () => {
  test("a large square og:image logo is logo-suspect (the 1024x1024 Flexell case)", () => {
    expect(logoShaped({ w: 1024, h: 1024 })).toBe(true);
  });

  test("a small square logo is logo-suspect", () => {
    expect(logoShaped({ w: 400, h: 400 })).toBe(true);
  });

  test("a landscape press photograph is not", () => {
    expect(logoShaped({ w: 1200, h: 890 })).toBe(false);
  });

  test("a tall portrait photograph is not", () => {
    expect(logoShaped({ w: 600, h: 900 })).toBe(false);
  });

  test("missing or degenerate dimensions are not", () => {
    expect(logoShaped(null)).toBe(false);
    expect(logoShaped({ w: 0, h: 100 })).toBe(false);
  });
});

describe("trimWhiteBorders letterbox shave", () => {
  const dark = (w: number, h: number) =>
    sharp({ create: { width: w, height: h, channels: 3, background: "#1a1a2e" } })
      .png()
      .toBuffer();
  const onWhiteCanvas = async (w: number, h: number, inner: Buffer, left: number, top: number) =>
    sharp({ create: { width: w, height: h, channels: 3, background: "#ffffff" } })
      .composite([{ input: inner, left, top }])
      .png()
      .toBuffer();

  test("shaves white side bars off a letterboxed graphic", async () => {
    const graphic = await dark(840, 628);
    const boxed = await onWhiteCanvas(1200, 628, graphic, 180, 0);
    const trimmed = await trimWhiteBorders(new Uint8Array(boxed));
    expect(trimmed).not.toBeNull();
    const m = await sharp(trimmed!).metadata();
    expect(m.width).toBeLessThan(900);
    expect(m.height).toBe(628);
  });

  test("leaves an image with non-white corners untouched", async () => {
    const photo = await dark(800, 600);
    expect(await trimWhiteBorders(new Uint8Array(photo))).toBeNull();
  });

  test("rejects a content crop: small subject on a large white canvas", async () => {
    const subject = await dark(180, 180);
    const canvas = await onWhiteCanvas(900, 600, subject, 360, 210);
    expect(await trimWhiteBorders(new Uint8Array(canvas))).toBeNull();
  });

  test("rejects a trim that would fall below the minimum dimension", async () => {
    const sliver = await dark(600, 190);
    const boxed = await onWhiteCanvas(620, 210, sliver, 10, 10);
    expect(await trimWhiteBorders(new Uint8Array(boxed))).toBeNull();
  });

  test("returns null on an entirely white image", async () => {
    const blank = await sharp({
      create: { width: 400, height: 300, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    expect(await trimWhiteBorders(new Uint8Array(blank))).toBeNull();
  });
});

describe("decodesAsQr gate", () => {
  // The real thing: Sina Finance's WeChat QR code, stamped as Gravity-1
  // launch artwork on 2026-07-22 because it was the article's only
  // in-body image and passed every size gate.
  test("the Sina WeChat QR code that shipped as launch artwork decodes as a QR", async () => {
    const qr = new Uint8Array(
      await Bun.file("scripts/__tests__/fixtures/sina-wechat-qr.webp").arrayBuffer(),
    );
    expect(await decodesAsQr(qr)).toBe(true);
  });

  test("a photograph-like image does not", async () => {
    const photo = await sharp({
      create: { width: 800, height: 450, channels: 3, background: "#1a1a2e" },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 300, height: 200, channels: 3, background: "#c0713a" },
          })
            .png()
            .toBuffer(),
          left: 120,
          top: 90,
        },
      ])
      .jpeg()
      .toBuffer();
    expect(await decodesAsQr(new Uint8Array(photo))).toBe(false);
  });

  test("undecodable bytes pass the gate rather than deciding it", async () => {
    expect(await decodesAsQr(new Uint8Array([1, 2, 3, 4]))).toBe(false);
  });
});
