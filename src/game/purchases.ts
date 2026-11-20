import { Capacitor } from "@capacitor/core";
import {
  PRODUCT_CATEGORY,
  PURCHASES_ERROR_CODE,
  Purchases,
  type CustomerInfo,
  type PurchasesStoreProduct,
} from "@revenuecat/purchases-capacitor";
import { REVENUECAT_ANDROID_KEY, REVENUECAT_IOS_KEY } from "./billingConfig";
import { getSkin, SKINS, writeSave } from "./cosmetics";
import type { SaveData } from "./types";

/** Play / App Store product id and RevenueCat entitlement id for each paid skin. */
const SKIN_PRODUCT: Record<string, string> = {
  moss: "skin_moss",
  glider: "skin_glider",
  sunset: "skin_sunset",
  stormwing: "skin_stormwing",
};

const NOT_READY = "The store didn’t connect. Try the skin again in a moment.";

let configured: Promise<boolean> | null = null;

export function storeBillingReady(): boolean {
  return Capacitor.isNativePlatform() && Boolean(apiKey());
}

function apiKey(): string {
  return Capacitor.getPlatform() === "ios" ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
}

function ensureConfigured(): Promise<boolean> {
  if (!storeBillingReady()) return Promise.resolve(false);
  if (!configured) {
    configured = Purchases.configure({ apiKey: apiKey() })
      .then(() => true)
      .catch(() => false);
  }
  return configured;
}

function productId(skinId: string): string | undefined {
  return SKIN_PRODUCT[skinId];
}

function applyCustomerInfo(save: SaveData, info: CustomerInfo): SaveData {
  const active = info.entitlements.active;
  const free = save.ownedSkins.filter((id) => getSkin(id).priceCents === 0);
  const paid = SKINS.filter((skin) => {
    const id = productId(skin.id);
    return Boolean(id && active[id]);
  }).map((skin) => skin.id);
  const next: SaveData = { ...save, ownedSkins: [...new Set([...free, ...paid])] };
  writeSave(next);
  return next;
}

function cancelled(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      String((err as { code: unknown }).code) === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR,
  );
}

function failureText(err: unknown, fallback: string): string {
  if (cancelled(err)) return "Purchase cancelled.";
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

/** Read entitlements already known to RevenueCat. Does not show a store login. */
export async function syncOwnedSkins(save: SaveData): Promise<SaveData> {
  if (!(await ensureConfigured())) return save;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return applyCustomerInfo(save, customerInfo);
  } catch {
    return save;
  }
}

export async function purchaseSkin(
  save: SaveData,
  skinId: string,
): Promise<{ save: SaveData; message: string }> {
  const skin = getSkin(skinId);
  const id = productId(skinId);
  if (!id) {
    return {
      save,
      message: `${skin.name} is ${skin.priceCents === 0 ? "included" : "not for sale"}.`,
    };
  }
  if (!Capacitor.isNativePlatform()) {
    return {
      save,
      message: `${skin.name} is bought in the App Store and Google Play apps. This web build doesn’t charge.`,
    };
  }
  if (!(await ensureConfigured())) return { save, message: NOT_READY };

  let product: PurchasesStoreProduct | undefined;
  try {
    const { products } = await Purchases.getProducts({
      productIdentifiers: [id],
      type: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
    });
    product = products.find((item) => item.identifier === id) ?? products[0];
  } catch (err) {
    return { save, message: failureText(err, "The store didn’t return that skin.") };
  }
  if (!product) {
    return { save, message: `${skin.name} is not available from the store yet.` };
  }

  try {
    const result = await Purchases.purchaseStoreProduct({ product });
    const next = applyCustomerInfo(save, result.customerInfo);
    const owned = next.ownedSkins.includes(skinId);
    return {
      save: next,
      message: owned ? `${skin.name} is yours.` : "The store finished, but the skin is not unlocked yet.",
    };
  } catch (err) {
    return { save, message: failureText(err, "The purchase didn’t complete.") };
  }
}

export async function restorePurchases(save: SaveData): Promise<{ save: SaveData; message: string }> {
  if (!Capacitor.isNativePlatform()) {
    return {
      save,
      message: "Restore purchases works in the App Store and Google Play apps. This web build doesn’t charge.",
    };
  }
  if (!(await ensureConfigured())) return { save, message: NOT_READY };
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    const next = applyCustomerInfo(save, customerInfo);
    const paid = next.ownedSkins.filter((id) => getSkin(id).priceCents > 0);
    const message = paid.length
      ? `Restored ${paid.map((id) => getSkin(id).name).join(", ")}.`
      : "No paid skins were found on this store account.";
    return { save: next, message };
  } catch (err) {
    return { save, message: failureText(err, "Restore didn’t complete.") };
  }
}
