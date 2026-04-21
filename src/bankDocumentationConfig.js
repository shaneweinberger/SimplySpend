export const bankDocumentationConfig = {
    // 1. Define the order of the tabs here
    availableBanks: ['TD Bank', 'CIBC', 'RBC', 'Chase'],

    // 2. Define the content for each bank
    banks: {
        'TD Bank': {
            name: "TD Bank",
            link: "https://easyweb.td.com/",
            linkText: "Go to TD Bank",
            steps: [
                {
                    number: 1,
                    title: "Log in and select your account",
                    description: "Sign in to your TD Bank online banking portal. From your dashboard, click on the specific checking or credit card account you want to track.",
                    // To use images, save them in the `public/bank-guides/` folder and link them here:
                    imagePath: "/bank-guides/td-guide/TD-1.png",
                    imagePlaceholder: "Screenshot Placeholder: Account Selection"
                },
                {
                    number: 2,
                    title: "Find the Download button",
                    description: "Above your list of recent transactions on the right side, locate and click the \"Download\" icon.",
                    imagePath: "/bank-guides/td-guide/TD-2.png",
                    imagePlaceholder: "Screenshot Placeholder: Download Icon"
                },
                {
                    number: 3,
                    title: "Select CSV format and date range",
                    description: "A pop-up will appear. Select the date range you want to export (if applicable), Choose \"Spreadsheet (.csv)\" as your format. then click Download to save the file to your computer.",
                    imagePath: "/bank-guides/td-guide/TD-3.png",
                    imagePlaceholder: "Screenshot Placeholder: Date Range Modal"
                }
            ]
        },
        // The other banks are blurred out in the UI until you remove the "!= 'TD Bank'" check,
        // but you can scaffold their content here in the meantime.
        'CIBC': {
            name: 'CIBC',
            link: 'https://www.cibc.com/',
            linkText: 'Go to CIBC',
            steps: [
                {
                    number: 1,
                    title: "Step 1 Title",
                    description: "Step 1 description here.",
                    imagePath: "",
                    imagePlaceholder: "Screenshot Placeholder 1"
                }
            ]
        },
        'RBC': {
            name: 'RBC',
            link: 'https://www.rbcroyalbank.com/',
            linkText: 'Go to RBC',
            steps: [
                {
                    number: 1,
                    title: "Step 1 Title",
                    description: "Step 1 description here.",
                    imagePath: "",
                    imagePlaceholder: "Screenshot Placeholder 1"
                }
            ]
        },
        'Chase': {
            name: 'Chase',
            link: 'https://www.chase.com/',
            linkText: 'Go to Chase',
            steps: [
                {
                    number: 1,
                    title: "Step 1 Title",
                    description: "Step 1 description here.",
                    imagePath: "",
                    imagePlaceholder: "Screenshot Placeholder 1"
                }
            ]
        }
    }
};
