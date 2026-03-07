export const referrals = [
  {
    id: 1,
    name: "Sarah Chen",
    title: "Engineering Manager, Frontend Platform",
    company: "Stripe",
    avatar: "SC",
    avatarColor: "bg-blue-500",
    relevanceScore: 92,
    reasons: ["Hiring Manager", "Alumni: UC Berkeley", "2nd Degree"],
    jobId: 1,
    profile: {
      summary:
        "Sarah manages a team of 8 frontend engineers at Stripe's platform org. She's been at Stripe for 4 years and is currently scaling her team to own the next-gen web SDK. She posts frequently about developer experience and engineering culture.",
      sharedContext:
        "You both attended UC Berkeley (CS '14 vs '16). She has starred 3 of your public GitHub repos related to React performance. She also commented on a blog post you wrote about component architecture in 2023.",
      outreachAngle:
        "Lead with the Berkeley alumni connection. Then mention your Angular-to-React migration leadership experience — she posted about exactly that challenge 2 weeks ago.",
    },
    suggestedMessage: `Hi Sarah,\n\nI came across your profile while researching Stripe's frontend platform work — impressive scale. I also noticed we're both Berkeley CS alumni (I was class of '16).\n\nI'm a Senior Frontend Engineer with 5 years of experience, most recently leading a full Angular-to-React migration for a mid-size SaaS company. Given your team's focus on platform infrastructure, I thought there might be a fit worth a quick conversation.\n\nWould you be open to a 20-minute chat?\n\nBest,\n[Your Name]`,
    status: "pending",
    followUpDate: null,
  },
  {
    id: 2,
    name: "Marcus Williams",
    title: "Staff Engineer",
    company: "Vercel",
    avatar: "MW",
    avatarColor: "bg-gray-700",
    relevanceScore: 89,
    reasons: ["2nd Degree", "Shared GitHub Activity", "Open Role Match"],
    jobId: 6,
    profile: {
      summary:
        "Marcus is a Staff Engineer at Vercel's infrastructure team. He's been an active open source contributor since 2015 and speaks frequently at Next.js conferences.",
      sharedContext:
        "You both follow @vercel on Twitter. Marcus liked your tweet about App Router performance. You've both contributed to a Next.js discussion thread on GitHub.",
      outreachAngle:
        "Reference your shared interest in Next.js performance. Mention a specific problem you've solved with App Router that's relevant to what Vercel builds.",
    },
    suggestedMessage: `Hi Marcus,\n\nI've been following your work on Vercel's infrastructure — particularly your talk on edge rendering at Next.js Conf. Really sharp perspective on the caching model.\n\nI'm currently exploring new roles as a Senior Frontend Engineer. My background is in TypeScript + React at scale, and I've been deep in Next.js App Router for the past year. I noticed Vercel is hiring on the frontend infra side and thought a conversation might be worthwhile.\n\nWould love to connect if you have 15 minutes.\n\nBest,\n[Your Name]`,
    status: "pending",
    followUpDate: null,
  },
  {
    id: 3,
    name: "Priya Nair",
    title: "Senior Software Engineer",
    company: "Shopify",
    avatar: "PN",
    avatarColor: "bg-emerald-500",
    relevanceScore: 85,
    reasons: ["Same University", "1st Degree", "Design Systems Focus"],
    jobId: 4,
    profile: {
      summary:
        "Priya is a Senior SWE on Shopify's Polaris design system team. She's been at Shopify for 3 years and is a key contributor to their accessibility initiatives.",
      sharedContext:
        "You're connected on LinkedIn and she's liked several of your posts. You both graduated from Waterloo's CS program — you overlapped for one year.",
      outreachAngle:
        "You're a 1st degree connection so keep it brief and direct. Reference Polaris and your design system work. Mention the accessibility angle since that's her specialty.",
    },
    suggestedMessage: `Hi Priya,\n\nLong time no talk! I've been keeping up with the Polaris work you've been sharing — the accessibility updates look great.\n\nI'm currently looking for my next role in design systems engineering and Shopify immediately came to mind given your team's reputation. I'd love to hear more about what the team is working on and whether there might be a fit.\n\nCoffee chat some time this week?\n\nBest,\n[Your Name]`,
    status: "pending",
    followUpDate: null,
  },
  {
    id: 4,
    name: "Jordan Lee",
    title: "Engineering Manager",
    company: "Figma",
    avatar: "JL",
    avatarColor: "bg-red-500",
    relevanceScore: 81,
    reasons: ["Hiring Manager", "3rd Degree", "Shared Interests"],
    jobId: 3,
    profile: {
      summary:
        "Jordan manages Figma's UI Infrastructure team. The team of 12 builds the rendering engine that powers Figma's canvas. Jordan is hiring for 2 senior roles right now.",
      sharedContext:
        "You're connected through two mutual connections in the design engineering space. Jordan attended a Figma talk you presented at a React meetup in 2022.",
      outreachAngle:
        "Reference your interest in high-performance rendering. Figma is obsessed with frame rates and canvas performance — lead with something you've built that required pushing browser limits.",
    },
    suggestedMessage: `Hi Jordan,\n\nI've been fascinated by Figma's rendering architecture — the way you've pushed the browser to handle a real-time collaborative canvas is genuinely impressive.\n\nI'm a Senior Frontend Engineer specializing in performance-critical UIs. Most recently I optimized our app's render pipeline reducing jank by 40% on low-end devices. I'd love to learn more about the UI Infrastructure work and explore whether there's a fit.\n\nWould you be open to a quick chat?\n\n[Your Name]`,
    status: "pending",
    followUpDate: null,
  },
  {
    id: 5,
    name: "Aisha Thompson",
    title: "Tech Lead, Growth",
    company: "Linear",
    avatar: "AT",
    avatarColor: "bg-indigo-600",
    relevanceScore: 88,
    reasons: ["Hiring Manager", "Mutual Connection", "Recent Post Match"],
    jobId: 2,
    profile: {
      summary:
        "Aisha is the tech lead for Linear's growth team. She joined from Figma 18 months ago and has been scaling Linear's onboarding and activation metrics significantly.",
      sharedContext:
        "Aisha recently posted about hiring for a growth-focused frontend engineer — the role matches exactly what you're looking for. A mutual connection (David Park from Intercom) can introduce you.",
      outreachAngle:
        "Mention David Park as a common connection to warm the intro. Reference Aisha's recent post about growth eng challenges. Lead with a specific metric from your experience.",
    },
    suggestedMessage: `Hi Aisha,\n\nDavid Park suggested I reach out — he thought there might be a good fit given your team's current focus on growth engineering.\n\nI'm a Frontend Engineer with experience driving activation improvements through thoughtful onboarding UX. At my current company, I owned the onboarding funnel and improved week-1 retention by 18% through a series of A/B tests.\n\nI'd love to learn more about what the Growth team is building at Linear. Happy to share more about my work if helpful.\n\nBest,\n[Your Name]`,
    status: "pending",
    followUpDate: null,
  },
  {
    id: 6,
    name: "Ryan Park",
    title: "Senior Engineer, AI Products",
    company: "Anthropic",
    avatar: "RP",
    avatarColor: "bg-orange-500",
    relevanceScore: 84,
    reasons: ["2nd Degree", "Shared Tech Blog Follower", "Relevant Team"],
    jobId: 11,
    profile: {
      summary:
        "Ryan joined Anthropic's Claude.ai team 8 months ago from a background in real-time web applications. He's active on Twitter discussing AI-native UX patterns.",
      sharedContext:
        "You both follow and have engaged with a common engineering blog (Dan Abramov's Overreacted). Ryan retweeted your comment about React Server Components last month.",
      outreachAngle:
        "Lead with a thoughtful take on AI-native UX – something you've been thinking about. Ryan responds well to engineers who have formed opinions, not just skills.",
    },
    suggestedMessage: `Hi Ryan,\n\nI've been following your thoughts on AI-native UX — really enjoyed your tweet thread about streaming UI patterns. I've been thinking a lot about the same problems.\n\nI'm a Frontend Engineer exploring roles where I can go deep on AI product interfaces. I've been building streaming response UIs as side projects and I'm genuinely excited about where this design space is heading. I noticed Anthropic is hiring on the web side.\n\nWould love to hear your perspective on what makes a great AI-product engineer.\n\n[Your Name]`,
    status: "pending",
    followUpDate: null,
  },
  {
    id: 7,
    name: "Natalie Torres",
    title: "Director of Engineering",
    company: "Brex",
    avatar: "NT",
    avatarColor: "bg-green-600",
    relevanceScore: 77,
    reasons: ["Hiring Manager", "3rd Degree", "Alumni Network"],
    jobId: 19,
    profile: {
      summary:
        "Natalie leads engineering for Brex's spend management products. She's scaling the team significantly in 2024 and posts regularly on engineering hiring and culture.",
      sharedContext:
        "You're connected through the YC alumni network (both attended YC Startup School). She's spoken positively about engineers with fintech domain experience.",
      outreachAngle:
        "Lead with fintech domain experience and use the YC startup school connection as a warm signal. Directors respond to confidence and directness.",
    },
    suggestedMessage: `Hi Natalie,\n\nI saw your post about scaling Brex's engineering team — exciting trajectory. We're both connected through the YC startup school network, which felt like a good reason to reach out directly.\n\nI'm a Senior Frontend Engineer with a fintech background (most recently at a Series B payments company). I've built complex financial UIs at scale and I'm exploring what's next. Brex is one of the companies I'm most excited about.\n\nWould love a brief conversation if your schedule allows.\n\n[Your Name]`,
    status: "pending",
    followUpDate: null,
  },
  {
    id: 8,
    name: "David Kim",
    title: "Engineering Manager",
    company: "Coinbase",
    avatar: "DK",
    avatarColor: "bg-blue-700",
    relevanceScore: 79,
    reasons: ["2nd Degree", "Open Role Match", "Fintech Domain"],
    jobId: 5,
    profile: {
      summary:
        "David manages Coinbase's mobile web team, overseeing React Native engineers working on the Coinbase Wallet experience.",
      sharedContext:
        "David and your former colleague Amy Zhang are connected — Amy can introduce you. David has an open req for a Senior React Native engineer.",
      outreachAngle:
        "Get a warm intro from Amy Zhang first. If not possible, reference your frontend expertise and express genuine interest in the mobile web overlap.",
    },
    suggestedMessage: `Hi David,\n\nAmy Zhang from [Previous Company] suggested I reach out — she thought there might be a fit given your team's current hiring needs.\n\nI'm a Senior Frontend Engineer making the transition into React Native. My web experience is deep (5 years, TypeScript/React at scale) and I've been building React Native side projects for the past year. I'd love to learn more about the Coinbase mobile team.\n\nWould you be open to a brief chat?\n\nBest,\n[Your Name]`,
    status: "pending",
    followUpDate: null,
  },
  {
    id: 9,
    name: "Elena Vasquez",
    title: "Senior Engineer",
    company: "Plaid",
    avatar: "EV",
    avatarColor: "bg-blue-500",
    relevanceScore: 86,
    reasons: ["2nd Degree", "Similar Background", "Referral Bonus Active"],
    jobId: 15,
    profile: {
      summary:
        "Elena is a Senior Engineer on Plaid's Link product. She's been there for 2 years and her company currently has an active employee referral bonus program.",
      sharedContext:
        "You attended the same JavaScript meetup in San Francisco 6 months ago and connected on LinkedIn afterward. Elena mentioned she's happy to refer strong engineers.",
      outreachAngle:
        "Elena mentioned she's open to referrals — be direct about asking for one while being genuine. Reference the JS meetup as the shared context.",
    },
    suggestedMessage: `Hi Elena,\n\nGreat connecting at the JS meetup a while back! I've been following Plaid's work — the Link product is genuinely impressive engineering.\n\nI'm actively exploring new opportunities and Plaid is near the top of my list. I noticed you mentioned being open to referring strong engineers — would you be willing to chat for 20 minutes so I can share my background and you can assess if I'd be a good fit to refer?\n\nNo pressure at all if the timing isn't right.\n\nBest,\n[Your Name]`,
    status: "pending",
    followUpDate: null,
  },
  {
    id: 10,
    name: "Tom Reardon",
    title: "Staff Software Engineer",
    company: "GitHub",
    avatar: "TR",
    avatarColor: "bg-gray-700",
    relevanceScore: 80,
    reasons: ["Open Source Collaboration", "2nd Degree", "Role Match"],
    jobId: 13,
    profile: {
      summary:
        "Tom is a Staff SWE working on GitHub's code editor experience. He's a maintainer of 3 open source projects and very active in the TypeScript community.",
      sharedContext:
        "You've both contributed to the same open source accessibility library. Tom reviewed and merged one of your PRs last year. He follows you on GitHub.",
      outreachAngle:
        "Lead with the open source collaboration — this is the strongest signal. Tom values contributors who do real work, not just theorize.",
    },
    suggestedMessage: `Hi Tom,\n\nI don't know if you remember, but you merged a PR of mine on [Library] about a year ago — the custom focus trap implementation. Small world.\n\nI'm exploring new roles and GitHub is somewhere I've always wanted to work. Given our shared background in the TypeScript/accessibility space, I thought a conversation would be worthwhile. I'm particularly excited about the code editing experience work your team is doing.\n\nWould you be open to a quick chat?\n\n[Your Name]`,
    status: "pending",
    followUpDate: null,
  },
  {
    id: 11,
    name: "Christina Park",
    title: "Engineering Manager, Design Systems",
    company: "Canva",
    avatar: "CP",
    avatarColor: "bg-cyan-600",
    relevanceScore: 82,
    reasons: ["Hiring Manager", "Shared Conference", "Alumni Network"],
    jobId: 20,
    profile: {
      summary:
        "Christina manages Canva's design systems team globally. She's based in Sydney but manages a distributed team. She's an advocate for accessibility-first component design.",
      sharedContext:
        "You both attended CSSconf last year and she commented on your tweet about design token architecture. She's been actively posting about her team's openings.",
      outreachAngle:
        "Reference the CSSconf connection and her tweet response. Lead with design system experience and your accessibility work — that's what she's optimizing for.",
    },
    suggestedMessage: `Hi Christina,\n\nI believe we crossed paths (virtually) at CSSconf last year — I remember your comment on my tweet about design token architecture. It sparked a really interesting conversation.\n\nI'm a Frontend Engineer with deep design systems experience, including a strong focus on accessibility and theming. I've been following Canva's DS work and I'm genuinely impressed by the scale you're operating at.\n\nI'd love to learn more about the team if you have 20 minutes.\n\nBest,\n[Your Name]`,
    status: "pending",
    followUpDate: null,
  },
  {
    id: 12,
    name: "James O'Brien",
    title: "Senior Engineer",
    company: "Mixpanel",
    avatar: "JO",
    avatarColor: "bg-purple-600",
    relevanceScore: 74,
    reasons: ["1st Degree", "Former Colleague", "Same Team Focus"],
    jobId: 10,
    profile: {
      summary:
        "James and you worked together briefly at a previous company through a contractor engagement. He joined Mixpanel 14 months ago and is on the data visualization team.",
      sharedContext:
        "You've worked together before. James posted about hiring on his team 3 weeks ago.",
      outreachAngle:
        "This is a warm connection — be direct. Reference your past work together and express genuine interest in the analytics visualization work.",
    },
    suggestedMessage: `Hey James,\n\nHope you're doing well! I've been following your journey at Mixpanel — looks like the team is doing really interesting things with the visualization layer.\n\nI'm currently exploring new opportunities and analytics UI is something I'm particularly excited about. Given we've worked together before, I wanted to reach out directly — would you be open to sharing what the hiring landscape looks like on your team?\n\nWould love to reconnect.\n\n[Your Name]`,
    status: "pending",
    followUpDate: null,
  },
  {
    id: 13,
    name: "Sophia Grant",
    title: "Product Manager, Frontend Platform",
    company: "DoorDash",
    avatar: "SG",
    avatarColor: "bg-red-600",
    relevanceScore: 71,
    reasons: ["2nd Degree", "Platform Team Hiring", "Role Match"],
    jobId: 12,
    profile: {
      summary:
        "Sophia is a PM on DoorDash's frontend platform team. While she's not an engineer, she's involved in hiring decisions and can champion candidates internally.",
      sharedContext:
        "You're both connected through a common LinkedIn group on product-engineering collaboration. She responds well to engineers who think in user-centric terms.",
      outreachAngle:
        "Talk about platform engineering from the product impact angle. PMs love engineers who understand how technical work drives user outcomes.",
    },
    suggestedMessage: `Hi Sophia,\n\nI came across your profile while researching DoorDash's frontend platform work. I know it's less common to reach out to PMs when job searching, but I've found the best conversations come from connecting with people close to the impact of the work.\n\nI'm a Senior Frontend Engineer interested in platform roles where I can improve developer velocity and ultimately user experience. I'd love to learn more about what your team is building.\n\nWould you have 15 minutes for a quick chat?\n\n[Your Name]`,
    status: "pending",
    followUpDate: null,
  },
  {
    id: 14,
    name: "Liam Foster",
    title: "VP of Engineering",
    company: "Faire",
    avatar: "LF",
    avatarColor: "bg-amber-600",
    relevanceScore: 68,
    reasons: ["3rd Degree", "Hiring Push", "Marketplace Domain"],
    jobId: 17,
    profile: {
      summary:
        "Liam is VP of Engineering at Faire and has been on a significant hiring push for their marketplace team. He posts frequently about their engineering culture.",
      sharedContext:
        "You have a 3rd degree connection through a former colleague. Liam has posted 3 times in the last month about engineering hiring at Faire.",
      outreachAngle:
        "Short and direct. VPs get a lot of messages — lead with a single compelling statement about your background, reference marketplace experience, ask for an intro to the team lead.",
    },
    suggestedMessage: `Hi Liam,\n\nBrief message: I'm a Senior Frontend Engineer with marketplace product experience looking for my next role. I've followed Faire's growth trajectory and I'm genuinely excited about what you're building.\n\nI noticed you're actively hiring on the engineering side. Would you be willing to connect me with the right person on your team for an initial conversation?\n\nAppreciate your time.\n\n[Your Name]`,
    status: "pending",
    followUpDate: null,
  },
  {
    id: 15,
    name: "Mei Zhang",
    title: "Senior Engineer, Web Platform",
    company: "Datadog",
    avatar: "MZ",
    avatarColor: "bg-violet-600",
    relevanceScore: 76,
    reasons: ["2nd Degree", "Performance Domain", "Similar Stack"],
    jobId: 18,
    profile: {
      summary:
        "Mei is a Senior Engineer on Datadog's web platform team, focused on rendering performance for their dashboards. She's been at Datadog for 2.5 years.",
      sharedContext:
        "You've both commented on the same blog post about React reconciler internals. You share a mutual connection who can provide context.",
      outreachAngle:
        "Lead with your performance engineering background — Datadog is obsessed with fast dashboards. Reference something specific about their technical challenges.",
    },
    suggestedMessage: `Hi Mei,\n\nI've been deep in React rendering performance for the past few years — your team's work on Datadog's dashboard performance is exactly the kind of problem I find most interesting.\n\nI'm a Senior Frontend Engineer exploring new roles, and Datadog is high on my list. My background includes canvas-based rendering, virtual scrolling, and memory profiling for complex data-heavy UIs.\n\nWould you be open to a conversation about the team's work?\n\n[Your Name]`,
    status: "pending",
    followUpDate: null,
  },
];

export const followUps = [
  {
    id: 101,
    referralId: 1,
    name: "Sarah Chen",
    company: "Stripe",
    dueDate: "2024-01-22",
    message: `Hi Sarah,\n\nFollowing up on my message from last week — I know you're likely busy, just wanted to make sure this didn't get buried.\n\nHappy to work around your schedule for a quick 15-minute chat.\n\nBest,\n[Your Name]`,
  },
  {
    id: 102,
    referralId: 4,
    name: "Jordan Lee",
    company: "Figma",
    dueDate: "2024-01-23",
    message: `Hi Jordan,\n\nJust wanted to circle back — still very interested in learning more about Figma's UI Infrastructure work. Would love to connect briefly if you have availability.\n\n[Your Name]`,
  },
  {
    id: 103,
    referralId: 7,
    name: "Natalie Torres",
    company: "Brex",
    dueDate: "2024-01-25",
    message: `Hi Natalie,\n\nFollowing up from my message earlier this week. If this week doesn't work, I'm happy to plan for next week instead.\n\nAppreciate your time either way.\n\n[Your Name]`,
  },
];
