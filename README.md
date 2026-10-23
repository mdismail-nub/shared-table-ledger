# Shared Table Ledger

I have uploaded the ui kit and logo for my website called mess manager.  And here is the features breakdown i want you to generate the website.  Focus on ui ux mainly because i will do the remaining work later but for now i want an amazing ui ux for the website . Mess Manager — Complete Feature Plan



Project Overview



Mess Manager is a modern, responsive web application designed to help students, roommates, and shared households manage meals, groceries, deposits, shared expenses, and monthly accounts.



The primary goal is to make mess accounting transparent and simple. Every member should be able to understand how much they spent, how much they owe, and how their monthly meal cost is calculated.



1. Dashboard



The dashboard provides a complete overview of the current month's financial activity.



Overview Cards



- Total monthly expenses

- Total meal count

- Current meal rate

- Total deposits collected

- Total shared household bills

- Outstanding member balances



Financial Insights



- Daily and monthly spending charts

- Expense category breakdown

- Deposit versus expense comparison

- Month-over-month expense trends

- Meal consumption statistics



Recent Activity



Display recently recorded:



- Bazar expenses

- Member deposits

- Meal updates

- Household bill payments

- Account adjustments



Each activity should include its date, amount, category, and associated member.



2. Member Management



Every mess member should have an individual financial profile.



Features



- Add, edit, and remove members

- Store name, contact details, joining date, and membership status

- Track deposits, withdrawals, and advances

- Record daily breakfast, lunch, and dinner meals

- Calculate monthly meal totals automatically

- View individual financial statements

- Track outstanding dues and remaining balances

- Support members joining or leaving during a month



Member Profile Summary



Each member profile should display:



- Total meals consumed

- Total meal cost

- Total deposits

- Shared household bill contribution

- Outstanding amount or remaining credit

- Complete transaction history



3. Meal Management



The meal management module records each member's daily meal consumption.



Features



- Record breakfast, lunch, and dinner

- Support configurable meal counts, including 0, 0.5, 1, or 2 meals

- Edit incorrect meal entries

- View daily, weekly, and monthly meal summaries

- Set meal-off days and meal schedules

- Display meal records in a calendar or table

- Calculate individual and total monthly meals

- Allow authorized users to correct previous entries



The interface should make it possible to update multiple members' meals quickly without opening a separate form for every member.



4. Expense and Bazar Management



Expenses must be divided into two separate categories to ensure accurate accounting.



A. Meal Expenses



Examples:



- Rice

- Vegetables

- Fish and meat

- Eggs

- Cooking oil

- Spices

- Other food-related purchases



These expenses contribute to the monthly meal-rate calculation.



B. Shared Household Expenses



Examples:



- Wi-Fi bills

- Electricity bills

- Gas bills

- Water bills

- Cleaning supplies

- Other agreed household costs



These expenses must be tracked separately and excluded from the meal-rate calculation.



Expense Management Features



- Add, edit, and delete expenses

- Record amount, date, category, description, and purchaser

- Attach receipt images when available

- Record payment methods and payment sources

- Filter expenses by date, category, member, and expense type

- View daily, weekly, and monthly expense summaries

- Maintain an audit trail for corrections and deletions



Important accounting rule: Wi-Fi, electricity, gas, and other shared household bills must never accidentally increase the meal rate.



5. Deposit and Payment Management



This module tracks money received from members and payments made for mess expenses.



Features



- Record member deposits

- Track deposit dates and amounts

- Support cash, bank transfers, and mobile financial services

- Record advances and refunds

- View payment history

- Track outstanding deposits and unpaid dues

- Generate individual deposit statements

- Compare total deposits against total member charges



Deposits represent money received from members, not expenses. They should increase the member's available credit.



6. Automatic Monthly Accounting



The accounting engine calculates the meal rate, individual meal costs, shared expenses, and final member balances.



Meal Rate Formula



Meal Rate = Total Meal Expenses / Total Meals



Example:



Total Meal Expenses = ৳30,000

Total Meals = 600



Meal Rate = 30,000 / 600

Meal Rate = ৳50



Individual Meal Cost



Member Meal Cost = Member's Total Meals × Meal Rate



Individual Amount Due



Amount Due = Meal Cost + Member's Shared Expense Contribution



Individual Balance



Member Balance = Total Deposits - Total Amount Due



Balance Interpretation



- Positive balance: The member has remaining credit.

- Negative balance: The member owes money.

- Zero balance: The member's account is settled.



Shared Expense Allocation



Support configurable allocation methods:



- Equal division among eligible members

- Custom contribution amounts

- Percentage-based allocation

- Other agreed allocation rules



The app should clearly display how each member's final amount is calculated.



Accounting Requirements



- Exclude shared household bills from food expenses.

- Exclude deposits from expense totals.

- Avoid counting the same transaction twice.

- Handle zero-meal months safely.

- Validate transactions before saving.

- Recalculate affected member balances when authorized corrections occur.



7. Month-End Closing and Reports



Provide a dedicated month-end closing screen to summarize the mess's financial status.



Monthly Summary



- Total food expenses

- Total household bills

- Total meals consumed

- Final meal rate

- Total deposits collected

- Total amount due from members

- Remaining credits and unpaid dues



Reporting Features



- Member-by-member financial statements

- Expense breakdown by category

- Complete transaction history

- Printable monthly reports

- CSV and PDF exports

- Monthly archives

- Balance carry-forward to the next month, when applicable



Month Closing



- Review all meal records and expenses

- Identify missing or invalid entries

- Display the final accounting summary

- Require confirmation before closing the month

- Restrict accidental changes to finalized accounts

- Support authorized corrections with an audit trail



8. Application Navigation



The application should include the following main pages:



Page| Purpose

Dashboard| Monthly overview and financial insights

Members| Member profiles and individual accounts

Meals| Daily meal entry and monthly totals

Expenses| Bazar purchases and household bills

Deposits & Payments| Deposits, withdrawals, and payment history

Monthly Accounts| Meal rate, dues, and balance settlement

Reports| Charts, statements, and exports

Settings| Mess details, categories, and accounting rules



9. UI Kit and Reusable Components



Build a consistent design system with reusable components.



Component| Purpose

Header / Topbar| Page title, month selector, profile, notifications

Sidebar / Mobile Navigation| Navigate between modules

Statistic Cards| Display meal rate, expenses, deposits, and balances

Data Tables| Display members, transactions, and meal records

Status Badges| Paid, pending, settled, and overdue statuses

Form Dialogs| Add meals, expenses, deposits, and members

Date and Month Picker| Filter records and select accounting periods

Search and Filters| Find members and transactions

Charts| Visualize expense trends and category breakdowns

Confirmation Dialogs| Confirm deletions and month closing

Toast Notifications| Display success messages and errors

Empty States| Guide users when no records exist

Loading Skeletons| Improve the experience while data loads

Pagination| Navigate large transaction and member lists



Visual Design Direction



- Use a clean white or light background.

- Use blue as the primary action color.

- Use subtle cyan, mint, and lime accents selectively.

- Use bold headings and readable body typography.

- Maintain consistent spacing and rounded corners.

- Keep cards clean and avoid unnecessary decoration.

- Ensure every page works well on mobile, tablet, and desktop.

- Use clear icons and consistent button styles.

- Provide accessible contrast and visible focus states.



10. Advanced Features



These features can be introduced after the core accounting workflow is stable.



- Multiple mess or household workspaces

- Admin and member roles with permissions

- Member self-service meal entry with admin approval

- Notifications for unpaid balances and month-end closing

- Recurring household bills

- Receipt image uploads

- Activity logs and audit history

- Offline support with safe data synchronization

- Data backup and restore

- Installable Progressive Web App (PWA)

- Member-specific access to financial statements



11. Recommended Development Roadmap



Phase 1 — Foundation



- Authentication

- Mess settings

- Member management

- Dashboard layout

- Responsive navigation



Phase 2 — Daily Operations



- Meal tracking

- Bazar expense management

- Shared household bills

- Member deposits

- Payment history



Phase 3 — Accounting Engine



- Automatic meal-rate calculation

- Individual member balances

- Shared expense allocation

- Monthly settlement

- Accounting validation and correction rules



Phase 4 — Reports



- Financial charts

- Monthly summaries

- Member statements

- CSV and PDF exports

- Month-end closing and archives



Phase 5 — Polish and Reliability



- Mobile responsiveness

- Role-based permissions

- Data backup and restore

- Offline support

- Error handling

- Accounting tests

- Security and usability improvements



12. Core Principles



1. Accurate accounting: All calculations must follow clearly defined rules.

2. Expense separation: Food expenses and household bills must remain separate.

3. Financial transparency: Members should understand every charge and balance.

4. Easy daily use: Recording meals, purchases, and deposits should require minimal effort.

5. Responsive design: The application must work smoothly on mobile devices.

6. Data integrity: Prevent duplicate transactions, invalid entries, and accidental changes.

7. Privacy and permissions: Only authorized users should be able to modify sensitive financial records.

8. Clear reporting: Month-end accounts should be easy to review, export, and verify.



Final Recommendation



Build the first version around four essential workflows:



1. Record daily meals.

2. Record food expenses and shared household bills separately.

3. Track member deposits and payments.

4. Calculate the meal rate and each member's final monthly balance automatically.



Once these workflows are reliable, expand into analytics, advanced reports, notifications, offline support, and multi-mess management.



The most important requirement is that the meal rate must be calculated only from meal-related expenses, never from Wi-Fi or other shared household bills.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/36e058a0-368f-4562-bf68-4982f2289b64).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
