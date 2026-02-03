// =============================================================================
// js/app.js (PATCH) - Fix offset=true and show Airtable 422 details on save
// - If your current app.js already handles inventory, you can just copy the bits:
//   1) In loadInventario: only pass offset token, never boolean
//   2) In save catch: print err.response.data.details for Airtable message
// =============================================================================
(() => {
  // This patch is minimal: it only adds better error logging for save.
  // If you already have the full app.js, keep it; this is optional.
  window.__inventarioDebugLog = function __inventarioDebugLog(err) {
    const data = err?.response?.data;
    console.error('Inventario save error full:', data || err);
    if (data?.details) console.error('Airtable details:', data.details);
    if (data?.mappedSent) console.error('Mapped fields sent to Airtable:', data.mappedSent);
    return data;
  };
})();
