export const context = {
  service: "MiseNote, a fictional payments and sales management SaaS for retail stores",
  receivedAt: "2026-09-19T10:00:00+09:00",
  background:
    "Customer companies use the service for checkout, cashless payments, and recording and reporting sales. It supports sales reports across multiple stores and CSV exports. Accounts and data are managed separately for each customer company. The provider charges each company a monthly subscription based on its number of stores.",
  support:
    "Support receives all inquiries and handles customer communication. Other departments participate in resolving inquiries.",
};

export const inquiries = [
  {
    id: "T-101",
    title: "Unfamiliar stores are showing up in our sales list",
    body: "There is no rush, but when I logged in this morning, I noticed stores that do not belong to our company in the sales list. Clicking a store name lets me see its daily sales amounts too. I logged out and back in, but they are still there. Could we have changed a setting by mistake?",
  },
  {
    id: "T-102",
    title: "Our store logo is misaligned",
    body: "Please fix this right away. Our store logo sticks out slightly to the right of its frame on the settings page. Uploading the image again makes no difference. Checkout and sales reports still work, but it bothers me because I see this page every day.",
  },
  {
    id: "T-103",
    title: "We cannot complete checkout at any of our stores",
    body: "Could you take a look when you have a moment? Since we opened at 9 a.m., all 12 stores have been getting an error when completing checkout. We cannot record a sale even on another device or after switching to cash. Customers are waiting at the checkout counters.",
  },
  {
    id: "T-104",
    title: "We cannot complete checkout at any of our stores",
    body: "Please resolve this immediately! Since we opened at 9 a.m., all 12 stores have been getting an error when completing checkout. We cannot record a sale even on another device or after switching to cash. Customers are waiting at the checkout counters.",
  },
  {
    id: "T-105",
    title: "We would like our internal store codes in the sales CSV",
    body: "We would appreciate this as soon as possible. Every time headquarters imports the sales CSV, we manually add our internal store codes. It would help to export the codes alongside store names starting with next month’s reporting. I looked through the settings but could not find an option.",
  },
  {
    id: "T-106",
    title: "We were charged twice for our September subscription",
    body: "Our card statement shows two finalized charges for the same amount for our September MiseNote subscription. We have not changed our plan or store count. Could you refund one if this is a duplicate charge?",
  },
  {
    id: "T-107",
    title: "I would like to check our subscription charges",
    body: "Opening the statement on the MiseNote billing page sometimes gives an error. I managed to open it after reloading, but this month’s amount was higher than last month’s. I would like to check whether this is a display issue or a change in pricing. Payment is due at the end of this month.",
  },
  {
    id: "T-108",
    title: "How do I export a CSV?",
    body: "We would like to export last month’s sales for all stores as a CSV. Which screen should we use? We need it for a headquarters meeting next week. At the moment, we copy the numbers from each store’s screen by hand.",
  },
  {
    id: "T-109",
    title: "It stopped working",
    body: "It has not been working for a little while. Could you check?",
  },
  {
    id: "T-110",
    title: "Our store logo is misaligned",
    body: "Whenever you have time is fine. Our store logo sticks out slightly to the right of its frame on the settings page. Uploading the image again makes no difference. Checkout and sales reports still work, but it bothers me because I see this page every day.",
  },
  {
    id: "T-111",
    title: "Could we get a quote for 10 additional stores?",
    body: "We plan to add 10 stores in November. Could you send us a quote, including the price for an annual contract? We would like to have it in time for our internal approval meeting next Friday.",
  },
  {
    id: "T-112",
    title: "We would like advice on rolling this out to our other stores",
    body: "We started using the service at two stores last month and would like to expand to the rest. Each store manager handles end-of-day closing differently, and headquarters is unsure how to standardize the process. Could we discuss how to proceed, including training our staff?",
  },
] as const;

export type InquiryId = (typeof inquiries)[number]["id"];
export interface Inquiry {
  id: InquiryId;
  title: string;
  body: string;
}

export const INQUIRY_LANGUAGES = ["en", "ja"] as const;
export type InquiryLanguage = (typeof INQUIRY_LANGUAGES)[number];
export const languageNames: Record<InquiryLanguage, string> = { en: "English", ja: "日本語" };

export function isInquiryLanguage(value: unknown): value is InquiryLanguage {
  return INQUIRY_LANGUAGES.some((language) => language === value);
}

const japaneseInquiries: Record<InquiryId, Pick<Inquiry, "title" | "body">> = {
  "T-101": {
    title: "売上一覧に見覚えのない店舗が表示されています",
    body: "急ぎではありませんが、今朝ログインしたところ、当社のものではない店舗が売上一覧に表示されていることに気づきました。店舗名をクリックすると、その店舗の日ごとの売上金額も見られます。ログアウトして入り直しても、まだ表示されています。こちらで誤って何かの設定を変更してしまったのでしょうか。",
  },
  "T-102": {
    title: "店舗ロゴの位置がずれています",
    body: "今すぐ直してください。設定画面で、店舗ロゴが枠から少し右にはみ出しています。画像をアップロードし直しても変わりません。会計や売上レポートは使えていますが、毎日見る画面なので気になります。",
  },
  "T-103": {
    title: "全店舗で会計を完了できません",
    body: "時間のあるときに見てもらえますか。午前9時の開店以降、全12店舗で会計を完了しようとするとエラーが出ています。別の端末を使っても、現金払いに切り替えても、売上を登録できません。お客様がレジで待っています。",
  },
  "T-104": {
    title: "全店舗で会計を完了できません",
    body: "今すぐ解決してください！ 午前9時の開店以降、全12店舗で会計を完了しようとするとエラーが出ています。別の端末を使っても、現金払いに切り替えても、売上を登録できません。お客様がレジで待っています。",
  },
  "T-105": {
    title: "売上CSVに社内の店舗コードを入れたいです",
    body: "できるだけ早く対応していただけると助かります。本部で売上CSVを取り込むたびに、社内の店舗コードを手作業で追加しています。来月の報告から、店舗名と一緒に店舗コードも出力できると助かります。設定を探しましたが、そのような項目は見つかりませんでした。",
  },
  "T-106": {
    title: "9月分の利用料金が二重に請求されています",
    body: "カードの利用明細に、9月分のMiseNote利用料金として同じ金額の確定済みの請求が2件あります。プランや店舗数は変更していません。二重請求であれば、片方を返金してもらえますか。",
  },
  "T-107": {
    title: "利用料金について確認したいです",
    body: "MiseNoteの請求画面で明細を開こうとすると、ときどきエラーになります。再読み込みすると開けたのですが、今月の金額が先月より高くなっていました。表示の問題なのか、料金が変わったのかを確認したいです。支払期限は今月末です。",
  },
  "T-108": {
    title: "CSVを出力するにはどうすればよいですか",
    body: "全店舗の先月の売上をCSVで出力したいです。どの画面を使えばよいですか。来週の本部会議で必要です。現在は、店舗ごとの画面から数字を手作業で転記しています。",
  },
  "T-109": {
    title: "動かなくなりました",
    body: "少し前から動かなくなっています。確認してもらえますか。",
  },
  "T-110": {
    title: "店舗ロゴの位置がずれています",
    body: "時間のあるときで構いません。設定画面で、店舗ロゴが枠から少し右にはみ出しています。画像をアップロードし直しても変わりません。会計や売上レポートは使えていますが、毎日見る画面なので気になります。",
  },
  "T-111": {
    title: "10店舗追加する場合の見積もりをお願いできますか",
    body: "11月に10店舗を追加する予定です。年間契約の場合の料金も含めて、見積もりを送ってもらえますか。来週金曜日の社内承認会議に間に合うように受け取りたいです。",
  },
  "T-112": {
    title: "ほかの店舗への展開について相談したいです",
    body: "先月から2店舗で利用を始め、残りの全店舗にも広げたいと考えています。営業終了時の締め作業の進め方が店長によって異なり、本部では手順をどう統一すればよいか分からずにいます。従業員への研修も含め、進め方を相談できますか。",
  },
};

export function localizeInquiry(inquiry: Inquiry, language: InquiryLanguage): Inquiry {
  return language === "en" ? inquiry : { id: inquiry.id, ...japaneseInquiries[inquiry.id] };
}
