import { useState } from "react";
import { useLanguage } from "../i18n";

// The photo-upload counterpart to PdfDocument — much simpler, since there's
// no text layer to overlay highlights on top of. Every term is still
// explained in the findings list; what's missing here specifically is the
// in-context highlighting PdfDocument gets from pdf.js's TextLayer, which
// has no equivalent for a flat raster image without a real bounding-box OCR
// layout to draw over (a larger feature, not attempted here).
export default function ImageDocument({ url }) {
  const { t } = useLanguage();
  const [loadFailed, setLoadFailed] = useState(false);

  if (loadFailed) {
    return <p className="error-text" role="alert">{t("documentViewer.imagePreviewUnavailable")}</p>;
  }

  return (
    <div className="image-viewer">
      <img
        className="image-viewer-img"
        src={url}
        alt={t("documentViewer.originalDocument")}
        onError={() => setLoadFailed(true)}
      />
    </div>
  );
}
