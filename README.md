# Invoice AI

# HONESTINVOICE.COM COMPLETE REBUILD PROMPT
## Production-Ready Invoicing Platform for Lovable.dev

### OVERVIEW
Rebuild honestinvoice.com from scratch as a production-ready, enterprise-grade invoicing and automated estimates platform. This is NOT a prototype - it must be 100% production ready with clean, efficient, logical code following industry standards.

---

## PAGES TO RECREATE (from sitemap.xml)

### PUBLIC PAGES
1. **Homepage** (`/`) - Landing page with hero, features, how-it-works, target audience, FAQ, footer
2. **Blog** (`/blog`) - Blog listing page
3. **Blog Posts** (5 articles):
   - `/blog/free-invoice-generator-for-hvac-contractors`
   - `/blog/how-to-create-invoice-for-freelance-work`
   - `/blog/what-is-a-payment-link-and-why-you-need-one`
   - `/blog/invoice-vs-estimate-when-to-use-each`
   - `/blog/best-invoicing-practices-for-contractors`
4. **Sign Up** (`/signup`) - Registration page
5. **Login** (`/login`) - Authentication page
6. **Pricing** (`/pricing`) - Subscription plans (Free, Pro, Business)
7. **Privacy Policy** (`/privacy`) - Full privacy policy
8. **Terms of Service** (`/terms`) - Full terms of service
9. **Investor Pitch** (`/pitch`) - Pitch deck presentation
10. **Pay Invoice** (`/pay-invoice`) - Public invoice payment page

---

## CURRENT FEATURES IDENTIFIED

### Core Features
- **Invoice Creation**: Professional invoice generator
- **Estimates**: Estimate creation and management
- **Recurring Invoices**: Automated recurring billing
- **Payment Reminders**: Automated payment follow-ups
- **Multi-Currency**: International support
- **Mobile Friendly**: Responsive design
- **Customizable Templates**: Branding with logo support

### Advanced Features (from pricing page)
- **Lead Gen Engine**: Lead generation capabilities
- **AI Extraction**: Automated line item extraction from job descriptions
- **Offline Ready**: PWA/offline functionality
- **Cash Velocity**: Financial metrics dashboard

---

## TECHNICAL REQUIREMENTS

### AI PROVIDERS
- **Primary**: NVIDIA AI (Nemotron models via NVIDIA API)
- **Backup**: OpenRouter API for redundancy/failover
- **Implementation**: Dual-provider setup with automatic fallback

#### NVIDIA Integration Details
```
# NVIDIA AI Configuration
NVIDIA_API_KEY=your_key_here
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=nemotron-4-34b-reward  # Latest Nemotron model
NVIDIA_MAX_TOKENS=4096

# Recommended NVIDIA models for this application:
# - nemotron-4-34b-reward (general AI tasks, estimates)
# - nemotron-4-34b-reward-inference (chat, client interactions)
# - nemotron-340b (advanced reasoning, cash forecasting)
```

#### AI Service Layer Implementation
```
/src/services/ai.service.ts
- Primary provider: NVIDIA API via fetch/axios
- Fallback: OpenRouter with same payload format
- Retry logic with exponential backoff
- Response caching for identical requests
- Rate limit handling (30 RPM for NVIDIA free tier)
- Streaming support for real-time responses
- Structured output parsing (JSON schema validation)
```

#### AI Endpoints Detailed
1. **Line Item Extraction** - Parse job descriptions into structured invoice items
2. **Estimate Generation** - Transform project scope into professional estimates
3. **Smart Reminders** - Generate personalized payment follow-up messages
4. **Cash Flow Forecasting** - Predict future cash flow based on historical data
5. **Client Risk Scoring** - Analyze payment patterns for risk assessment
6. **Category Pricing** - Industry-specific pricing suggestions
7. **Contract Review** - Analyze terms for potential issues (Pro feature)

### PAYMENT PROCESSING
- **Provider**: Stripe (already in use - keep existing integration)
- **Features**: Subscription billing, one-time payments, payment links
- **PCI Compliance**: Handled by Stripe - never store card data
- **Webhooks**: Handle subscription events, payment successes/failures

### EMAIL/SMTP
- **Provider**: Resend (already configured)
- **Usage**: Transactional emails (invoices, reminders, notifications)

### DATABASE
- **Type**: SQL database (PostgreSQL recommended)
- **Migrate from**: Any existing NoSQL to SQL
- **Schema**: Fully normalize for production scale

---

## SECURITY STANDARDS (MUST IMPLEMENT ALL)

### Authentication & Authorization
- JWT-based authentication with refresh tokens
- OAuth 2.0 integration (Google Sign-In)
- Multi-factor authentication (MFA) support
- Session management with secure cookies
- Password hashing with bcrypt/argon2
- Rate limiting on auth endpoints

### Data Protection
- Encryption at rest (AES-256)
- TLS 1.3 for all communications
- CSRF protection on all forms
- XSS prevention with input sanitization
- SQL injection prevention (parameterized queries)
- Input validation on all endpoints
- CORS configured properly

### Compliance
- GDPR compliance (data export/deletion)
- SOC 2 Type II ready architecture
- PCI DSS compliant (no card storage - use Stripe)
- Privacy-first design (data minimization)

### Additional Security
- Content Security Policy (CSP) headers
- Security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
- API rate limiting (per-user, per-endpoint)
- Audit logging for sensitive operations
- Secrets management via environment variables

---

## FUTURE OF INVOICING & AUTOMATED ESTIMATES

### AI-Powered Features (The "Future" Aspect)
1. **Smart Line Item Extraction**
   - Natural language processing for job descriptions
   - Auto-generate invoice line items from brief descriptions
   - Regional pricing based on location/cost of living
   - Category-aware pricing suggestions

2. **Automated Estimates**
   - AI-generated estimates from project scope
   - Predictive pricing based on historical data
   - Industry benchmarking
   - Automatic revision tracking

3. **Intelligent Payment Follow-ups**
   - AI-personalized reminder messages
   - Optimal timing based on client behavior
   - Multi-channel follow-ups (email, SMS)

4. **Cash Flow Intelligence**
   - Predictive cash flow forecasting
   - Late payment risk scoring
   - Automated credit policies

5. **Client Intelligence**
   - Payment history analysis
   - Creditworthiness scoring
   - Churn prediction for retainers

---

## DATABASE SCHEMA (NEW SQL SCHEMA)

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255),
    company_name VARCHAR(255),
    phone VARCHAR(50),
    timezone VARCHAR(100) DEFAULT 'UTC',
    plan_id UUID REFERENCES plans(id),
    stripe_customer_id VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    tax_id VARCHAR(100),
    logo_url VARCHAR(500),
    brand_color VARCHAR(7),
    invoice_prefix VARCHAR(20) DEFAULT 'INV',
    default_payment_terms INTEGER DEFAULT 30,
    default_currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clients table
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    tax_id VARCHAR(100),
    notes TEXT,
    credit_score DECIMAL(3,2),
    avg_payment_days INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plans table
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    price_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    billing_interval VARCHAR(20) DEFAULT 'monthly',
    features JSONB,
    stripe_price_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id),
    invoice_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    issue_date DATE,
    due_date DATE,
    paid_date TIMESTAMP WITH TIME ZONE,
    subtotal_cents INTEGER NOT NULL,
    tax_cents INTEGER DEFAULT 0,
    total_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    tax_rate DECIMAL(5,4) DEFAULT 0,
    notes TEXT,
    payment_link_token UUID UNIQUE,
    stripe_payment_intent_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice items table
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    rate_cents INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    tax_rate DECIMAL(5,4) DEFAULT 0,
    sort_order INTEGER DEFAULT 0
);

-- Estimates table
CREATE TABLE estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id),
    estimate_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    issue_date DATE,
    expiry_date DATE,
    subtotal_cents INTEGER NOT NULL,
    tax_cents INTEGER DEFAULT 0,
    total_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    notes TEXT,
    ai_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Estimate items table
CREATE TABLE estimate_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    rate_cents INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    sort_order INTEGER DEFAULT 0
);

-- Recurring templates table
CREATE TABLE recurring_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id),
    name VARCHAR(255) NOT NULL,
    frequency VARCHAR(20) NOT NULL, -- weekly, monthly, quarterly, yearly
    next_date DATE,
    end_date DATE,
    subtotal_cents INTEGER NOT NULL,
    tax_cents INTEGER DEFAULT 0,
    total_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads table (Lead Gen Engine)
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(100),
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    service_needed TEXT,
    estimated_value_cents INTEGER,
    status VARCHAR(50) DEFAULT 'new', -- new, contacted, converted, rejected
    ai_score DECIMAL(3,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    converted_at TIMESTAMP WITH TIME ZONE
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    related_id UUID, -- invoice_id, estimate_id, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id),
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50),
    stripe_payment_intent_id VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_payment_link ON invoices(payment_link_token);
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_leads_user_id ON leads(user_id);
CREATE INDEX idx_estimates_user_id ON estimates(user_id);
```

---

## FUNCTIONAL REQUIREMENTS

### User Management
- Registration with email/password
- OAuth via Google
- Email verification
- Password reset flow
- Profile management
- MFA setup (TOTP)

### Invoice Management
- Create/edit/delete invoices
- PDF generation
- Email invoices directly
- Public payment links
- Status tracking (draft, sent, paid, overdue)
- Payment recording
- Invoice duplication

### Estimate Management
- Create/edit/delete estimates
- Convert estimates to invoices
- PDF generation
- Status tracking (draft, sent, accepted, rejected)
- Expiration dates

### Recurring Invoices
- Template creation
- Frequency settings
- Auto-generation
- Status management

### Lead Management
- Lead capture forms
- Lead scoring (AI-powered)
- Lead status tracking
- Conversion tracking

### Reporting & Analytics
- Revenue overview
- Outstanding invoices
- Payment history
- Cash velocity metrics
- Client payment patterns

---

## DESIGN REQUIREMENTS

### UI/UX Standards
- Clean, minimal design (SaaS aesthetic)
- Responsive mobile-first
- Dark/light mode toggle
- Consistent spacing (8px grid)
- Accessible (WCAG 2.1 AA)
- Fast loading (< 2s)

### Brand Elements
- Primary color: Professional blues
- Clean typography (Inter, system fonts)
- Modern iconography (Lucide icons)
- Professional invoice templates

---

## GENERATIVE ENGINE OPTIMIZATION (GEO) & SEO

### GEO (Generative Engine Optimization) - Based on Google's Official Guide
**Note from Google:** "AEO" (Answer Engine Optimization) and "GEO" (Generative Engine Optimization) are terms used to describe work focused on AI search experiences, but from Google's perspective, optimizing for generative AI search is still SEO. Google Search does NOT use LLMS.txt files or special AI markup - focus on proven SEO best practices.

### What Actually Matters for GEO (per Google):
1. **Foundational SEO is ALL you need** - Google's generative AI features use RAG (Retrieval-Augmented Generation) and query fan-out, which rely on traditional SEO-optimized content

2. **Focus on Unique, Non-Commodity Content**
   - Provide unique point of view (not generic recycled content)
   - Content must be helpful, reliable, and people-first
   - Well-organized with clear headings and section structure
   - Add high-quality images and video where appropriate

3. **Technical Structure for AI Discovery**
   - Ensure content is crawlable and indexable
   - Follow all standard SEO technical best practices
   - Semantic HTML helps (but doesn't need to be perfect)
   - Good page experience (fast, mobile-friendly, accessible)

### SEO Requirements (Complete Implementation)
1. **Meta Tags**
   - Unique title tags (50-60 chars) for every page
   - Meta descriptions (150-160 chars) for every page
   - Open Graph tags (og:title, og:description, og:image, og:url)
   - Twitter cards (twitter:card, twitter:title, twitter:description)
   - Canonical URLs on all pages

2. **Technical SEO**
   - XML Sitemap at `/sitemap.xml` (auto-generated)
   - robots.txt with proper directives
   - Structured data (JSON-LD) for Organization, Website, BlogPosting
   - Breadcrumb schema markup
   - FAQ schema on FAQ sections
   - Article schema on blog posts

3. **Content SEO**
   - Semantic HTML (proper H1-H6 hierarchy)
   - Alt text on all images
   - Clean URLs (slug-based, not query params)
   - Internal linking between related content
   - Schema.org markup for invoices (CreativeWork)

4. **Performance SEO**
   - Lazy loading for images
   - Critical CSS inlining
   - Font optimization (font-display: swap)
   - Image optimization (WebP, AVIF)
   - Minify CSS/JS (Terser, CSSNano)

### What NOT to Do (per Google's Mythbusting)
- ❌ No LLMS.txt or special AI markup needed
- ❌ No "chunking" content into tiny pieces
- ❌ No separate content for every query variation
- ❌ No scaled content abuse for AI manipulation

### Internationalization (i18n)
1. **Language Detection**
   - Auto-detect browser language
   - i18n support (en, es, fr, de, it, pt, nl minimum)
   - Language switcher in UI
   - hreflang tags for SEO

2. **Currency Support**
   - Multi-currency display (150+ currencies)
   - Localized pricing
   - Currency conversion in invoices

### SEO Implementation Files
- `/src/components/SEO.tsx` - React helmet component for meta tags
- `/src/lib/seo.ts` - SEO utilities and structured data generators
- `/src/pages/sitemap.xml.ts` - Auto-generated sitemap
- `/next-seo.config.js` - Next.js SEO configuration
- `/src/lib/content.ts` - Content structure helpers (for human + AI readability)
- `/src/locales/` - i18n translation files (en.json, es.json, etc.)

---

## API ENDPOINTS (REST)

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/verify-email` - Email verification
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `PUT /api/users/password` - Change password

### Clients
- `GET /api/clients` - List clients
- `POST /api/clients` - Create client
- `GET /api/clients/{id}` - Get client
- `PUT /api/clients/{id}` - Update client
- `DELETE /api/clients/{id}` - Delete client

### Invoices
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice
- `GET /api/invoices/{id}` - Get invoice
- `PUT /api/invoices/{id}` - Update invoice
- `DELETE /api/invoices/{id}` - Delete invoice
- `POST /api/invoices/{id}/send` - Send invoice
- `POST /api/invoices/{id}/duplicate` - Duplicate invoice
- `GET /api/invoices/{id}/pdf` - Download PDF
- `GET /api/invoices/public/{token}` - Public payment page

### Estimates
- `GET /api/estimates` - List estimates
- `POST /api/estimates` - Create estimate
- `GET /api/estimates/{id}` - Get estimate
- `PUT /api/estimates/{id}` - Update estimate
- `POST /api/estimates/{id}/accept` - Accept estimate
- `POST /api/estimates/{id}/convert` - Convert to invoice

### AI Features
- `POST /api/ai/extract-line-items` - Extract from description
- `POST /api/ai/generate-estimate` - AI estimate generation
- `GET /api/ai/cash-forecast` - Cash flow prediction
- `GET /api/ai/client-risk/{id}` - Client risk score

---

## INDUSTRY STANDARDS TO FOLLOW

### ISO/IEC 27001
- Information security management
- Risk assessment and treatment
- Security controls implementation

### OWASP Top 10 (2021)
- A01:2021 – Broken Access Control
- A02:2021 – Cryptographic Failures
- A03:2021 – Injection
- A04:2021 – Insecure Design
- A05:2021 – Security Misconfiguration
- A06:2021 – Vulnerable and Outdated Components
- A07:2021 – Identification and Authentication Failures
- A08:2021 – Software and Data Integrity Failures
- A09:2021 – Security Logging and Monitoring Failures
- A10:2021 – Server-Side Request Forgery (SSRF)

### SOC 2 Type II
- Security
- Availability
- Processing integrity
- Confidentiality
- Privacy

### PCI DSS
- Use Stripe for payments (never store card data)
- Secure transmission of cardholder data
- Vulnerability management

---

## INFRASTRUCTURE

### Tech Stack
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js (NestJS) or Python (FastAPI/Django)
- **Database**: PostgreSQL
- **Caching**: Redis for sessions/rate limiting
- **Queue**: BullMQ or Celery for background jobs
- **Storage**: AWS S3 or Cloudflare R2 for attachments

### Environment Variables (Required)
```
# Database
DATABASE_URL=postgresql://...

# AI Providers
NVIDIA_API_KEY=...
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
OPENROUTER_API_KEY=...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Email (Resend - already configured)
RESEND_API_KEY=...
RESEND_FROM=Honest Invoice <invoices@honestinvoice.com>

# Stripe (already in use)
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PUBLISHABLE_KEY=...

# Auth
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_URL=redis://...

# App
NODE_ENV=production
APP_URL=https://honestinvoice.com
NEXT_PUBLIC_APP_URL=https://honestinvoice.com

# SEO
NEXT_PUBLIC_SITE_NAME=\"Honest Invoice\"
```

---

## DEPLOYMENT CHECKLIST

### Pre-Launch Mandatory Checks
- [ ] All pages responsive on mobile/tablet/desktop
- [ ] SSL certificate installed and valid
- [ ] Database migrations run successfully
- [ ] All API endpoints tested
- [ ] PDF generation working
- [ ] Email sending verified
- [ ] Stripe webhook configured and tested
- [ ] Stripe subscription plans created and synced
- [ ] Rate limiting tested
- [ ] Security scan passed (OWASP ZAP)
- [ ] Lighthouse score > 90 (performance, SEO, accessibility)
- [ ] All forms validated
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Monitoring setup (Sentry/DataDog)
- [ ] Backup strategy in place
- [ ] GDPR compliance verified
- [ ] SEO meta tags on all pages
- [ ] Sitemap.xml auto-generated
- [ ] robots.txt optimized
- [ ] Structured data implemented (Schema.org)
- [ ] i18n routes working
- [ ] Currency detection tested
- [ ] hreflang tags for multilingual SEO
- [ ] CDN configuration verified
- [ ] Content is unique and non-commodity (GEO best practice)
- [ ] Content organized with clear headings structure

---

## DELIVERABLES

The final deliverable must include:
1. **Complete source code** with clear structure
2. **SQL schema and migrations**
3. **Environment configuration examples**
4. **Docker setup for production**
5. **API documentation (OpenAPI/Swagger)**
6. **Deployment guide**
7. **Security audit checklist**
8. **All pages from sitemap implemented**
9. **AI provider integration (NVIDIA + OpenRouter fallback)**
10. **Resend email integration ready**
11. **Production-ready authentication system**

---

## PROJECT STRUCTURE (REQUIRED)

```
honestinvoice/
├── packages/
│   ├── web/                 # Next.js frontend
│   │   ├── src/
│   │   │   ├── pages/       # All pages (homepage, blog, auth, dashboard)
│   │   │   ├── components/  # Reusable UI components
│   │   │   ├── lib/         # Utilities (seo.ts, api.ts, auth.ts)
│   │   │   └── styles/      # Tailwind config, global CSS
│   │   ├── public/          # Static assets, robots.txt, sitemap.xml
│   │   └── next.config.js
│   └── api/                # Backend API
│       ├── src/
│       │   ├── controllers/ # Route handlers
│       │   ├── services/    # Business logic (ai.service.ts, email.service.ts)
│       │   ├── middleware/  # Auth, rate limiting, security
│       │   ├── models/      # Database models
│       │   └── routes/      # API route definitions
│       └── prisma/         # SQL migrations (if using Prisma)
├── docker-compose.yml
├── Dockerfile
└── README.md
```

---

## FINAL NOTE

This is a complete rebuild for **production deployment**, not a prototype. Every line of code must be production-grade, following clean code principles. Security is non-negotiable - implement all standards above. The AI features using NVIDIA's API should be the core differentiator, making this truly "future-ready" invoicing software.

DO NOT return partial work. Every page, every API endpoint, every feature must be fully implemented and ready for production deployment.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d1c523e8-8d3e-455b-852b-efcdfd3c9980).

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
