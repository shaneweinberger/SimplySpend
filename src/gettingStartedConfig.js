/**
 * gettingStartedConfig.js
 *
 * Single source of truth for all text content on the Getting Started page.
 * Edit this file to update copy without touching any UI or logic in GettingStarted.jsx.
 */

export const gettingStartedConfig = {

    // ── Header ────────────────────────────────────────────────────────────────
    header: {
        title: "Welcome to Finsight",
        paragraphs: [
            "Never worry about your spending again. Finsight uses AI to securely process your data, giving you the analytics and insights you need most.",
            "Built on the idea that your data belongs to you, we never connect to your bank accounts or third parties. Instead, you upload your transactions directly.",
        ],
        // Displayed larger and bolder beneath the paragraphs above
        callToAction: "Follow the four simple steps below to get started.",
    },

    // ── Steps ─────────────────────────────────────────────────────────────────
    // Each step has a `lines` array — plain strings rendered as <p> tags.
    // The first line is always rendered bold/larger as the sub-headline.
    // Steps with bullet lists use a `bullets` array on that line object.
    steps: [
        {
            number: 1,
            title: "Download Your Transactions",
            navigateLabel: "View Step-by-Step Instructions",
            actionLabel: "Mark as Completed",
            lines: [
                { text: "Export your transactions as a CSV file from your bank or credit card provider.", bold: true },
                { text: "Log in to your bank's website and look for an option like Download, Export, or Transaction History." },
                { text: "Choose the CSV format." },
            ],
        },
        {
            number: 2,
            title: "Create AI Rules",
            navigateLabel: "Go to Rules",
            actionLabel: "Mark as Completed",
            lines: [
                { text: "Define how Finsight's AI processes your transactions.", bold: true },
                { text: "Create categories and rules to guide Finsight's AI when processing your transactions." },
                { text: "No need to create rules for every transaction, Finsight's AI accurately categorizes almost all transactions." },
            ],
        },
        {
            number: 3,
            title: "Upload & Process",
            navigateLabel: "Go to Uploads",
            actionLabel: "Mark as Completed",
            lines: [
                { text: "Upload your CSV file to Finsight.", bold: true },
                { text: "Finsight will automatically:" },
                {
                    bullets: [
                        "Clean and standardize your transaction data",
                        "Apply your AI rules",
                        "Categorize your spending",
                    ],
                },
                { text: "Processing usually takes just a few seconds.", italic: true },
            ],
        },
        {
            number: 4,
            title: "Analyze & Reconcile",
            navigateLabel: "Go to Analytics",
            actionLabel: "Mark as Completed",
            lines: [
                { text: "Explore your spending insights.", bold: true },
                { text: "View categorized trends and analyze your finances over time." },
                { text: "You can always edit transactions manually if something needs adjustment." },
                { text: "Tip: Review transfers carefully to avoid double-counting.", bold: true },
            ],
        },
    ],

    // ── Completion Card ───────────────────────────────────────────────────────
    completion: {
        title: "Setup Complete",
        body: "You're all set to take control of your financial data. Feel free to return to this guide anytime you download your transactions for a quick refresher.",
        feedbackTitle: "Notice anything unclear?",
        feedbackBody: "We're constantly improving this documentation. If you have questions or noticed something wrong, please let us know.",
        feedbackButtonLabel: "Submit Feedback",
    },

    // ── Footer ────────────────────────────────────────────────────────────────
    footer: {
        note: 'You can always return to this page by clicking "Getting Started" in the sidebar.',
        resetLabel: "Reset progress",
    },
};
