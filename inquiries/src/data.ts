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
];

export type Inquiry = (typeof inquiries)[number];
