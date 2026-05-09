export const SITE_NAME = "Bloop Cinemas";

/** Tiêu đề tab: `Trang con · Bloop Cinemas` */
export function formatPageTitle(pageTitle) {
  const t = pageTitle != null ? String(pageTitle).trim() : "";
  if (!t) return SITE_NAME;
  return `${t} · ${SITE_NAME}`;
}

export function setDocumentTitle(pageTitle) {
  document.title = formatPageTitle(pageTitle);
}
