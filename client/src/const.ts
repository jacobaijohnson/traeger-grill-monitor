export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Login URL — points to the local Better Auth login page.
 * No more Manus OAuth dependency.
 */
export const getLoginUrl = (returnPath?: string) => {
  const base = "/login";
  if (returnPath) {
    return `${base}?redirect=${encodeURIComponent(returnPath)}`;
  }
  return base;
};
