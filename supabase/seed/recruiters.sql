-- Seed: CareerPilot AI recruiter database
-- Run this in the Supabase SQL editor after schema.sql
-- 25 manually curated recruiters across India, US, Canada, Global

INSERT INTO public.recruiters (
  name, linkedin_url, current_company, title, type,
  specialization, seniority_levels, industry_focus,
  geography, cities,
  response_rate, avg_reply_days, placements_at,
  manually_curated, notes
) VALUES

-- ── India: Agency ────────────────────────────────────────────────
(
  'Anjali Mehta',
  'https://linkedin.com/in/anjali-mehta-recruiter',
  'Naukri.com', 'Senior Technical Recruiter', 'agency',
  ARRAY['engineering','pm'],
  ARRAY['mid','senior','lead'],
  ARRAY['saas','fintech','ecomm'],
  ARRAY['india'], ARRAY['bangalore','mumbai','delhi'],
  72, 2.0, ARRAY['Swiggy','Zomato','Razorpay','OYO'],
  true, 'High response rate. Strong Bangalore product startup network.'
),
(
  'Ravi Kumar',
  'https://linkedin.com/in/ravikumar-talent',
  'TeamLease Digital', 'Technical Recruitment Lead', 'agency',
  ARRAY['engineering','design'],
  ARRAY['junior','mid','senior'],
  ARRAY['saas','ecomm','general'],
  ARRAY['india'], ARRAY['bangalore','hyderabad','pune'],
  58, 3.5, ARRAY['Flipkart','Amazon India','Infosys'],
  true, 'Good for engineering roles. Mid-level focus.'
),
(
  'Pooja Joshi',
  'https://linkedin.com/in/poojajoshi-rec',
  'ABC Consultants', 'Assistant Manager – IT Recruitment', 'agency',
  ARRAY['engineering','pm','leadership'],
  ARRAY['senior','lead','csuite'],
  ARRAY['fintech','saas','ai'],
  ARRAY['india'], ARRAY['mumbai','bangalore','delhi'],
  65, 2.8, ARRAY['HDFC','ICICI Lombard','Groww','Zerodha'],
  true, 'BFSI and fintech specialist. Good senior network.'
),
(
  'Kiran Patel',
  'https://linkedin.com/in/kiranpatel-hr',
  'ManpowerGroup India', 'Talent Acquisition Manager', 'agency',
  ARRAY['engineering','design','leadership'],
  ARRAY['mid','senior','lead'],
  ARRAY['general','saas','ecomm'],
  ARRAY['india'], ARRAY['ahmedabad','mumbai','bangalore'],
  52, 4.0, ARRAY['Jio','Reliance','Meesho','Delhivery'],
  true, 'Gujarat/Mumbai focus. Good for mid-size companies.'
),

-- ── India: Inhouse ────────────────────────────────────────────────
(
  'Shweta Reddy',
  'https://linkedin.com/in/shweta-reddy-swiggy',
  'Swiggy', 'Lead Recruiter – Tech', 'inhouse',
  ARRAY['engineering','pm'],
  ARRAY['senior','lead'],
  ARRAY['ecomm','saas'],
  ARRAY['india'], ARRAY['bangalore'],
  80, 1.5, ARRAY['Swiggy'],
  true, 'Directly hires for Swiggy engineering. Very fast response. Hyper-growth.'
),
(
  'Arjun Malhotra',
  'https://linkedin.com/in/arjunmalhotra-razorpay',
  'Razorpay', 'Senior Technical Recruiter', 'inhouse',
  ARRAY['engineering','pm'],
  ARRAY['mid','senior','lead'],
  ARRAY['fintech','saas'],
  ARRAY['india'], ARRAY['bangalore'],
  85, 1.2, ARRAY['Razorpay'],
  true, 'Razorpay hires heavily. Strong fintech domain. Very active on LinkedIn.'
),
(
  'Neha Singh',
  'https://linkedin.com/in/neha-singh-meesho',
  'Meesho', 'Recruiter – Engineering', 'inhouse',
  ARRAY['engineering'],
  ARRAY['junior','mid','senior'],
  ARRAY['ecomm'],
  ARRAY['india'], ARRAY['bangalore'],
  70, 2.0, ARRAY['Meesho'],
  true, 'Meesho is in growth mode. Junior-to-senior range.'
),
(
  'Siddharth Gupta',
  'https://linkedin.com/in/siddharth-gupta-phonepe',
  'PhonePe', 'Talent Partner', 'inhouse',
  ARRAY['engineering','pm','design'],
  ARRAY['mid','senior','lead'],
  ARRAY['fintech'],
  ARRAY['india'], ARRAY['bangalore'],
  75, 1.8, ARRAY['PhonePe'],
  true, 'PhonePe is actively scaling. Fintech product focus.'
),
(
  'Priya Krishnan',
  'https://linkedin.com/in/priya-krishnan-cred',
  'CRED', 'Engineering Recruiter', 'inhouse',
  ARRAY['engineering','design'],
  ARRAY['senior','lead'],
  ARRAY['fintech','saas'],
  ARRAY['india'], ARRAY['bangalore'],
  68, 2.5, ARRAY['CRED'],
  true, 'CRED hires selectively — quality over quantity.'
),

-- ── India: Independent ────────────────────────────────────────────
(
  'Rohan Desai',
  'https://linkedin.com/in/rohan-desai-recruiter',
  'Independent', 'Freelance Tech Recruiter', 'independent',
  ARRAY['engineering','pm'],
  ARRAY['senior','lead'],
  ARRAY['saas','ai','fintech'],
  ARRAY['india'], ARRAY['bangalore','remote'],
  62, 3.0, ARRAY['Atlassian India','Salesforce India','Adobe India'],
  true, 'Ex-MNC recruiter now independent. Good for product companies.'
),
(
  'Sunita Sharma',
  'https://linkedin.com/in/sunita-sharma-talent',
  'Independent', 'Senior Career Consultant', 'independent',
  ARRAY['leadership','pm'],
  ARRAY['lead','csuite'],
  ARRAY['general','saas'],
  ARRAY['india'], ARRAY['delhi','mumbai'],
  55, 3.8, ARRAY['Paytm','MakeMyTrip','Nykaa'],
  true, 'Leadership and PM focus. Delhi NCR strong network.'
),
(
  'Amit Verma',
  'https://linkedin.com/in/amit-verma-ta',
  'Startup Talent Network', 'Founder', 'independent',
  ARRAY['engineering','design','pm'],
  ARRAY['mid','senior'],
  ARRAY['ai','saas'],
  ARRAY['india'], ARRAY['bangalore','hyderabad'],
  60, 2.2, ARRAY['Sarvam AI','BrowserStack','Postman','Hasura'],
  true, 'Startup-only recruiter. Strong AI startup network.'
),

-- ── US: Agency ────────────────────────────────────────────────────
(
  'Jessica Liu',
  'https://linkedin.com/in/jessica-liu-hired',
  'Hired', 'Senior Technical Sourcer', 'agency',
  ARRAY['engineering','pm'],
  ARRAY['mid','senior','lead'],
  ARRAY['saas','fintech','ai'],
  ARRAY['us'], ARRAY['bay_area','remote'],
  70, 2.5, ARRAY['Stripe','Twilio','Snowflake','Databricks'],
  true, 'Strong Bay Area SaaS/fintech network.'
),
(
  'Mike Thompson',
  'https://linkedin.com/in/mike-thompson-rht',
  'Robert Half Technology', 'Technology Staffing Manager', 'agency',
  ARRAY['engineering'],
  ARRAY['junior','mid','senior'],
  ARRAY['general','saas','ecomm'],
  ARRAY['us'], ARRAY['new_york','boston','remote'],
  48, 4.5, ARRAY['JPMorgan','Citigroup','Bloomberg'],
  true, 'Finance tech focus. NYC strong. Slower response.'
),
(
  'Sarah O''Brien',
  'https://linkedin.com/in/sarah-obrien-kforce',
  'Kforce', 'Principal Technical Recruiter', 'agency',
  ARRAY['engineering','design'],
  ARRAY['senior','lead'],
  ARRAY['ecomm','saas'],
  ARRAY['us'], ARRAY['seattle','remote'],
  65, 3.0, ARRAY['Amazon','Microsoft','T-Mobile'],
  true, 'Seattle/PNW focus. Enterprise + big tech.'
),
(
  'David Park',
  'https://linkedin.com/in/david-park-digital',
  'Digital People', 'Technical Recruiting Manager', 'agency',
  ARRAY['engineering','pm','design'],
  ARRAY['mid','senior','lead'],
  ARRAY['ai','saas','fintech'],
  ARRAY['us'], ARRAY['bay_area','los_angeles','remote'],
  73, 2.0, ARRAY['Anthropic','Scale AI','Figma','Linear'],
  true, 'AI/ML and product-focused startups. Highly active.'
),

-- ── US: Inhouse ───────────────────────────────────────────────────
(
  'Emily Chen',
  'https://linkedin.com/in/emily-chen-stripe',
  'Stripe', 'Engineering Talent Partner', 'inhouse',
  ARRAY['engineering','pm'],
  ARRAY['senior','lead'],
  ARRAY['fintech','saas'],
  ARRAY['us'], ARRAY['bay_area','remote'],
  88, 1.0, ARRAY['Stripe'],
  true, 'Stripe engineering team. Very selective. Responds fast to strong candidates.'
),
(
  'Marcus Johnson',
  'https://linkedin.com/in/marcus-johnson-airbnb',
  'Airbnb', 'Senior Technical Recruiter', 'inhouse',
  ARRAY['engineering','design'],
  ARRAY['senior','lead'],
  ARRAY['saas','ecomm'],
  ARRAY['us'], ARRAY['bay_area'],
  78, 1.8, ARRAY['Airbnb'],
  true, 'Airbnb design + engineering. Product-focused culture.'
),
(
  'Olivia White',
  'https://linkedin.com/in/olivia-white-oai',
  'OpenAI', 'Talent Acquisition Lead – Engineering', 'inhouse',
  ARRAY['engineering','pm'],
  ARRAY['senior','lead','csuite'],
  ARRAY['ai','saas'],
  ARRAY['us'], ARRAY['bay_area'],
  82, 1.5, ARRAY['OpenAI'],
  true, 'OpenAI engineering. Very competitive. Fast for standout candidates.'
),

-- ── US: Independent ────────────────────────────────────────────────
(
  'Alex Rivera',
  'https://linkedin.com/in/alex-rivera-recruiting',
  'Independent', 'Tech Recruiting Consultant', 'independent',
  ARRAY['engineering','pm'],
  ARRAY['mid','senior','lead'],
  ARRAY['saas','ai','fintech'],
  ARRAY['us','canada'], ARRAY['bay_area','toronto','remote'],
  67, 2.8, ARRAY['Vercel','Clerk','Supabase','PlanetScale'],
  true, 'Dev tools and infra startups. Good for Series A-B.'
),

-- ── Canada: Agency ────────────────────────────────────────────────
(
  'Sophie Martin',
  'https://linkedin.com/in/sophie-martin-ca',
  'Hays Canada', 'Technology Recruitment Consultant', 'agency',
  ARRAY['engineering'],
  ARRAY['mid','senior'],
  ARRAY['saas','fintech','general'],
  ARRAY['canada'], ARRAY['toronto','vancouver'],
  60, 3.2, ARRAY['Shopify','RBC','TD Bank','Wealthsimple'],
  true, 'Toronto/Vancouver focus. Bank + startup mix.'
),
(
  'James Wong',
  'https://linkedin.com/in/james-wong-randstad-ca',
  'Randstad Canada', 'Senior IT Recruiter', 'agency',
  ARRAY['engineering','pm'],
  ARRAY['senior','lead'],
  ARRAY['fintech','saas'],
  ARRAY['canada'], ARRAY['toronto'],
  55, 3.8, ARRAY['TD Bank','Manulife','Wealthsimple','Koho'],
  true, 'Financial services and fintech Canada. Senior roles.'
),

-- ── Canada: Inhouse ───────────────────────────────────────────────
(
  'Priya Patel',
  'https://linkedin.com/in/priya-patel-shopify-ca',
  'Shopify', 'Engineering Talent Acquisition Partner', 'inhouse',
  ARRAY['engineering','pm','design'],
  ARRAY['mid','senior','lead'],
  ARRAY['ecomm','saas'],
  ARRAY['canada'], ARRAY['ottawa','toronto','remote'],
  83, 1.3, ARRAY['Shopify'],
  true, 'Shopify is remote-first. Hyper-growth.'
),

-- ── Global / Remote ───────────────────────────────────────────────
(
  'Nina Kowalski',
  'https://linkedin.com/in/nina-kowalski-remote',
  'Remote Talent Network', 'Head of Global Recruitment', 'independent',
  ARRAY['engineering','pm'],
  ARRAY['senior','lead'],
  ARRAY['saas','ai'],
  ARRAY['india','us','canada'], ARRAY['remote'],
  62, 2.5, ARRAY['GitLab','Remote.com','Automattic','Doist'],
  true, 'Remote-first companies only. Global coverage.'
),
(
  'Carlos Mendez',
  'https://linkedin.com/in/carlos-mendez-globaltech',
  'TechNomads Recruiting', 'Technical Talent Director', 'independent',
  ARRAY['engineering','leadership'],
  ARRAY['lead','csuite'],
  ARRAY['saas','fintech'],
  ARRAY['india','us','canada'], ARRAY['remote'],
  58, 3.0, ARRAY['Toptal','Deel','Rippling','Remote.com'],
  true, 'Global remote + leadership. Good for lead-level roles.'
);
