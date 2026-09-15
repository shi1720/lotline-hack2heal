import { DomainError } from "./domain";
/** Stop reading at a byte cap, including chunked bodies with no Content-Length. */
export async function readBody(request: Request, limit = 250000) {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > limit)
    throw new DomainError("Request is too large.", 413);
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0,
    text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new DomainError("Request is too large.", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch (e) {
    if (e instanceof DomainError) throw e;
    throw new DomainError("Request is not valid UTF-8.", 400);
  } finally {
    reader.releaseLock();
  }
}
