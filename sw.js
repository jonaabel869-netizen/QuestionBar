
function isImageRequest(text) {
  const value = String(text || "").trim().toLowerCase();

  if (!value) return false;

  const imageWords =
    /\b(?:bild|bilder|foto|fotos|fotografie|zeichnung|illustration|grafik|render|kunstwerk|logo|thumbnail|hintergrundbild)\b/i;

  const actionWords =
    /\b(?:generiere|generier|erstelle|erstell|erzeuge|erzeug|zeichne|male|mach|mache|kreier|produzier|render)\b/i;

  if (imageWords.test(value) && actionWords.test(value)) {
    return true;
  }

  if (
    /\b(?:ich möchte|ich will|kannst du|bitte|mach mir|erstelle mir|generiere mir|erzeuge mir)\b[\s\S]{0,100}\b(?:bild|foto|zeichnung|illustration|grafik|render)\b/i.test(value)
  ) {
    return true;
  }

  if (
    /\b(?:bild|foto|zeichnung|illustration|grafik)\b[\s\S]{0,100}\b(?:erstellen|generieren|erzeugen|zeichnen|malen)\b/i.test(value)
  ) {
    return true;
  }

  return (
    /\b(?:foto|fotografie|bild|illustration|zeichnung|grafik|render)\b/i.test(value) &&
    /\b(?:realistisch|fotorealistisch|realistisches|realistische|erstelle|generiere|erzeuge|zeige|mach)\b/i.test(value)
  );
}
