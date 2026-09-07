# Honest Invoice SEO implementation

## Included

- Reworked global SEO title/description and robots directives.
- Absolute canonical URLs and OpenGraph/Twitter metadata on public marketing routes.
- Organization, WebSite, and SoftwareApplication JSON-LD at the root.
- FAQPage JSON-LD on the homepage and SEO landing pages.
- BreadcrumbList + SoftwareApplication + FAQPage JSON-LD on SEO landing pages.
- Expanded sitemap with all new acquisition/industry pages.
- Improved robots.txt with sitemap declaration and private/API exclusions.
- Added public `llms.txt` for AI/discovery context.
- Added `noindex` protection to authenticated, auth, login, and signup surfaces.
- Repositioned the homepage around the job-description -> AI line-items -> invoice/payment workflow.
- Added contractor-focused comparison positioning against QuickBooks, Wave, and Jobber.
- Added trust/security messaging.
- Added internal links to industry and acquisition pages.
- Added SEO landing pages for contractors, freelancers, small businesses, HVAC, plumbers, electricians, landscapers, and cleaners.
- Added free invoice, contractor invoice, and estimate acquisition pages.

## Testing

- All TypeScript/TSX source files passed a TypeScript transpile/parse check.
- Canonical scan found no remaining relative canonical URLs or relative `og:url` values in route metadata.
- Required private/auth routes were checked for `noindex`.
- Sitemap was checked for all 11 new SEO/acquisition paths.
- Required schema types were checked for Organization, WebSite, SoftwareApplication, FAQPage, and BreadcrumbList.
- `npm ci` was attempted, but the environment timed out while fetching/installing dependencies, leaving no runnable local `eslint`/Vite binaries. Therefore a full `npm run lint` and `npm run build` could not be completed in this environment.

## Deployment follow-up

After deployment, run the project's normal `npm run lint` and `npm run build`, then submit `https://honestinvoice.com/sitemap.xml` in Google Search Console. Validate representative URLs with Google's URL Inspection tool.
