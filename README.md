# CalcBloc Take-Home Pay for Job Listings (Chrome, Firefox, Edge)

A browser extension that spots salary figures on job listing pages and shows an estimated take-home pay next to them, using CalcBloc's public tax-tables API. You set your country and region once; the extension collects no browsing data.

> **Status:** in development. This repository will hold the source code; nothing has been released yet.

## What it will do

- Detects salaries on major job sites and shows the estimated net pay beside each one.
- Each estimate links to the full calculator on calcbloc.com.
- Minimum permissions, no tracking, no analytics. A plain-language privacy policy ships with it.
- Manifest V3; Chrome first, with Firefox and Edge builds from the same code.

## Data and licence

Tax data comes from [CalcBloc](https://calcbloc.com/data): every figure is taken from the official government source named next to it, with the date it was last checked. Data licence: CC BY 4.0, credit "Data by CalcBloc (calcbloc.com/data)". Code licence: MIT.

## Links

- Website: [calcbloc.com](https://calcbloc.com)
- Tax tables and downloads: [calcbloc.com/data](https://calcbloc.com/data)
- API documentation: [calcbloc.com/developers](https://calcbloc.com/developers)
