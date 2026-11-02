// Hide only exact, checksum-verified publisher HTML when checking the site's
// own paths and network addresses. Secret checks must run on the original text.
// This keeps public code examples intact without exempting a whole route/file.
export function maskPublisherBody(text: string, html: string) {
  if (!html) return text;
  const variants = new Set<string>();
  let encoded = html;
  for (let depth = 0; depth < 4; depth++) {
    variants.add(encoded);
    variants.add(
      encoded.replace(
        /[<>&\u2028\u2029]/g,
        (character) =>
          `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
      ),
    );
    encoded = JSON.stringify(encoded).slice(1, -1);
  }
  for (const value of [...variants].sort((a, b) => b.length - a.length))
    text = text.replaceAll(value, "[verified publisher body]");
  return text;
}
