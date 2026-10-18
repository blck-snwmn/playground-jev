import { validatePreparedImage } from "./image";
import { locate } from "./jev";
import { targetsSchema } from "./schema";

const error = (message: string, status: number) => Response.json({ error: message }, { status });

export async function handleLocate(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return error("Please run the request from this page.", 403);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("Could not read the image and questions.", 400);
  }
  const image = form.get("image");
  let input: unknown;
  try {
    const text = form.get("targets");
    if (typeof text !== "string") return error("Could not read the questions.", 400);
    input = JSON.parse(text);
  } catch {
    return error("Could not read the questions.", 400);
  }
  const targets = targetsSchema.safeParse(input);
  if (!targets.success) {
    return error("Enter 1 to 10 questions, each between 1 and 1000 characters.", 400);
  }
  if (!(image instanceof File) || !(await validatePreparedImage(image))) {
    return error("Could not read the image. Please select a PNG or JPEG again.", 400);
  }
  const key = process.env.JEV_API_KEY;
  if (!key)
    return error(
      "The server API key is missing. Set JEV_API_KEY in box/.env and restart the server.",
      503,
    );
  try {
    return Response.json(await locate(image, targets.data, key));
  } catch {
    return error(
      "The Jev request failed. Check the API key, usage limits, and connection, then try again.",
      502,
    );
  }
}
