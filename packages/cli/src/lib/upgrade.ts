import open from "open";
import { apiClient } from "./api-client";
import { getErrorMessage } from "./http-errors";

export async function openUpgradeCheckout() {
  const response = await apiClient.billing.checkout.$post();

  if (response.ok) {
    const data = await response.json();
    await open(data.url);
    return;
  }

  throw new Error(await getErrorMessage(response));
}

export async function openBillingPortal() {
  const response = await apiClient.billing.portal.$post();

  if (response.ok) {
    const data = await response.json();
    await open(data.url);
    return;
  }

  throw new Error(await getErrorMessage(response));
}
