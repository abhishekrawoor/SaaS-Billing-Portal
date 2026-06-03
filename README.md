# Role-Based SaaS Billing Portal

This project contains a simple full-stack SaaS billing portal with separate backend and frontend folders.

## Features

- Register customer with name and email
- Login using email
- Demo admin login: `abhi@admin.com`
- Demo customer login: `abhi@customer.com`
- Customer home page with subscription plans
- Plan start date and end date display
- Pay button with payment success message
- Customer profile with name, email, payment details, and logout
- Admin home page with customer login count and customer details
- Admin profile with name, email, and logout
- Admin can add and edit plans
- Plan changes appear on the customer home page
- Data is stored in `backend/data/db.json`

## Folder Structure

```text
role-based-saas-billing-portal/
  backend/
    data/
      db.json
    package.json
    server.js
  frontend/
    app.js
    index.html
    styles.css
  README.md
```

## Steps To Run

1. Install Node.js if it is not already installed.
2. Open a terminal in the `backend` folder.
3. Start the backend:

```bash
npm start
```

If Windows PowerShell blocks `npm start`, use this command instead:

```bash
node server.js
```

4. Keep the backend running.
5. Open `frontend/index.html` in your browser.
6. Login with one of these demo emails:

```text
Admin: abhi@admin.com
Customer: abhi@customer.com
```

## Notes

- No password is used because this version follows the requested email-based demo login.
- The backend runs on `http://localhost:5000`.
- If you edit plans as admin, refresh or reopen the customer page to see the latest plan list.
