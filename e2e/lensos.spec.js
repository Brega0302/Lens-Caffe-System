import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
test("warehouse issuance, two shift counts and final takings remain consistent", async ({
  page,
}) => {
  const credentials = JSON.parse(
      readFileSync(".local/e2e-credentials.json", "utf8"),
    ),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Korisničko ime").fill(credentials.username);
  await page.getByLabel("Lozinka", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await expect(page.getByRole("heading", { name: "Dobar dan" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Glavna navigacija" }),
    dialog = page.getByRole("dialog");
  await nav.getByRole("link", { name: "Magacin", exact: true }).click();
  await page.getByRole("button", { name: "Dodaj artikal" }).click();
  await dialog.getByLabel("Naziv artikla").fill("E2E sok");
  await dialog.getByLabel("Kategorija", { exact: true }).fill("Sokovi");
  await dialog.getByLabel("Jedinica mjere").selectOption("bottle");
  await dialog.getByLabel("Minimalna količina").fill("3");
  await dialog.getByLabel("Nabavna cijena (KM)").fill("1.20");
  await dialog.getByLabel("Prodajna cijena (KM)").fill("2.50");
  await dialog.getByRole("button", { name: "Spremi artikal" }).click();
  await expect(dialog).not.toBeVisible();
  await nav.getByRole("link", { name: "Nabavke", exact: true }).click();
  await page.getByRole("button", { name: "Nova nabavka" }).click();
  await dialog.getByLabel("Dobavljač", { exact: true }).fill("Test dobavljač");
  await dialog
    .getByRole("combobox", { name: "Artikal", exact: true })
    .selectOption({ label: "E2E sok · boca" });
  await dialog.getByLabel("Količina", { exact: true }).fill("10");
  await dialog.getByLabel("Jedinična cijena (KM)").fill("1.20");
  await dialog.getByRole("button", { name: "Potvrdi nabavku" }).click();
  await expect(dialog).not.toBeVisible();
  const issue = async (quantity) => {
    await nav
      .getByRole("link", { name: "Izdavanje robe", exact: true })
      .click();
    await page.getByRole("button", { name: "Izdaj robu", exact: true }).click();
    await dialog
      .getByRole("combobox", { name: "Artikal za izdavanje" })
      .selectOption({ index: 1 });
    await dialog.getByLabel("Količina za izdavanje").fill(quantity);
    await dialog.getByRole("button", { name: "Potvrdi izdavanje" }).click();
    await expect(dialog).not.toBeVisible();
  };
  await issue("6");
  await nav.getByRole("link", { name: "Knjiga pazara", exact: true }).click();
  await page.getByLabel("Predaja prve smjene · E2E sok").fill("2");
  await page
    .getByRole("button", { name: "Potvrdi predaju prve smjene" })
    .click();
  await dialog.getByRole("button", { name: "Potvrdi obračun" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.locator(".summary-card").filter({ hasText: "Pazar prve smjene" }),
  ).toContainText("10,00 KM");
  await issue("2");
  await nav.getByRole("link", { name: "Knjiga pazara", exact: true }).click();
  await page.getByLabel("Završno stanje · E2E sok").fill("1");
  await page.getByRole("button", { name: "Zaključi dan i pazar" }).click();
  await dialog.getByRole("button", { name: "Potvrdi obračun" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Dan zaključen", { exact: true })).toBeVisible();
  await expect(
    page.locator(".summary-card").filter({ hasText: "Ukupan pazar" }),
  ).toContainText("17,50 KM");
  await expect(page.locator(".info-strip")).toContainText("9,10 KM");
  mkdirSync(".local/screenshots", { recursive: true });
  await page.screenshot({
    path: ".local/screenshots/ledger-desktop.png",
    fullPage: true,
  });
  await nav.getByRole("link", { name: "Magacin", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "E2E sok" });
  await expect(row.getByRole("cell", { name: "2", exact: true })).toBeVisible();
  await expect(row.getByRole("cell", { name: "1", exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Historija kretanja" }).click();
  await expect(
    dialog.getByRole("cell", { name: "Prodaja iz kafića", exact: true }),
  ).toHaveCount(2);
  await dialog.getByRole("button", { name: "Zatvori" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await nav.getByRole("link", { name: "Knjiga pazara", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Knjiga pazara", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/screenshots/ledger-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
