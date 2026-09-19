import { inquiries } from "./data";
import { classifyInquiry } from "./jev";

export async function handleTriage(request: Request): Promise<Response> {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Please run classification from this page." }, { status: 403 });
  }
  let id: unknown;
  try {
    const body: unknown = await request.json();
    id = body && typeof body === "object" && "id" in body ? body.id : undefined;
  } catch {
    return Response.json({ error: "Could not read the request." }, { status: 400 });
  }
  const inquiry = inquiries.find((item) => item.id === id);
  if (!inquiry) {
    return Response.json({ error: "Inquiry not found." }, { status: 400 });
  }
  const apiKey = process.env.JEV_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error: "Set JEV_API_KEY in inquiries/.env and restart the server.",
      },
      { status: 503 },
    );
  }
  try {
    return Response.json(await classifyInquiry(inquiry, apiKey));
  } catch {
    // Never return upstream bodies or credentials to the browser.
    return Response.json(
      {
        error:
          "Jev classification failed. Check the API key, usage limits, and connection, then try again.",
      },
      { status: 502 },
    );
  }
}
