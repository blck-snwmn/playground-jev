import { validatePreparedImage } from "./image";
import { locate } from "./jev";
import { MAX_QUESTION_LENGTH } from "./schema";

const error = (message: string, status: number) => Response.json({ error: message }, { status });

export async function handleLocate(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return error("このページから実行してください。", 403);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("画像と質問文を読み取れませんでした。", 400);
  }
  const image = form.get("image");
  const question = form.get("question");
  if (
    typeof question !== "string" ||
    !question.trim() ||
    question.trim().length > MAX_QUESTION_LENGTH
  ) {
    return error("質問文を1〜1000文字で入力してください。", 400);
  }
  if (!(image instanceof File) || !(await validatePreparedImage(image))) {
    return error("画像を読み取れませんでした。PNGまたはJPEGを選び直してください。", 400);
  }
  const key = process.env.JEV_API_KEY;
  if (!key)
    return error(
      "サーバーのAPIキーが未設定です。box/.envにJEV_API_KEYを設定して再起動してください。",
      503,
    );
  try {
    return Response.json(await locate(image, question.trim(), key));
  } catch {
    return error(
      "Jevでの処理に失敗しました。APIキー、利用上限、接続を確認して再実行してください。",
      502,
    );
  }
}
