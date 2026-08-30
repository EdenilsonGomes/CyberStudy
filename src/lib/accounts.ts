import { getDb } from "@/db";
import { createAccountService } from "./accounts-core";
const service = () => createAccountService(getDb(), { email: process.env.ADMIN_EMAIL || "", password: process.env.ADMIN_PASSWORD || "" });
export const ensureLegacyAccount = () => service().ensureLegacyAccount();
export const allowAuthAttempt = (...args: Parameters<ReturnType<typeof service>["allowAuthAttempt"]>) => service().allowAuthAttempt(...args);
export const authenticateLocal = (...args: Parameters<ReturnType<typeof service>["authenticateLocal"]>) => service().authenticateLocal(...args);
export const issueAccountToken = (...args: Parameters<ReturnType<typeof service>["issueAccountToken"]>) => service().issueAccountToken(...args);
export const redeemAccountToken = (...args: Parameters<ReturnType<typeof service>["redeemAccountToken"]>) => service().redeemAccountToken(...args);
