import { Config } from "@measured/puck";
import { Hero } from "@/components/marketing/hero";
import { CTASection } from "@/components/marketing/cta-section";
import { LiveStatsStrip } from "@/components/marketing/live-stats-strip";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ChallengesPreview } from "@/components/marketing/challenges-preview";
import { PlatformFeatures } from "@/components/marketing/platform-features";
import { PayoutsSection } from "@/components/marketing/payouts-section";
import { Testimonials } from "@/components/marketing/testimonials";
import { FAQSection } from "@/components/marketing/faq-section";
import { HeadingBlock, TextBlock, ButtonBlock, SectionBlock, ColumnsBlock } from "@/components/puck/basic-blocks";

type Props = {
  Hero: { title: string; highlight: string; subtitle: string; badge: string };
  CTASection: { title: string; highlight: string; description: string };
  LiveStatsStrip: { items?: Array<{ label: string; value: string; subtext?: string }> };
  HowItWorks: { 
    badge: string; 
    titleText1: string; 
    titleAccent: string; 
    description: string;
    steps: Array<{ n: string; title: string; body: string; items: Array<{ itemText: string }> }>;
  };
  ChallengesPreview: { title: string };
  PlatformFeatures: { 
    titleText1: string; 
    titleAccent: string; 
    description: string; 
    features: Array<{ title: string; body: string }> 
  };
  PayoutsSection: {
    badge: string;
    titleText1: string;
    titleAccent: string;
    description: string;
    items: Array<{ itemText: string }>;
  };
  Testimonials: {
    badge: string;
    titleText1: string;
    titleAccent: string;
    stories: Array<{ name: string; role: string; quote: string; pnl: string; account: string }>;
  };
  FAQSection: {
    badge: string;
    titleText1: string;
    titleAccent: string;
    description: string;
    faqs: Array<{ q: string; a: string }>;
  };
  Heading: { text: string; size: "sm" | "md" | "lg" | "xl"; align: "left" | "center" | "right" };
  Text: { text: string; size: "sm" | "md" | "lg"; align: "left" | "center" | "right" };
  Button: { text: string; url: string; variant: "primary" | "secondary" | "outline" };
  Section: { padding: "10" | "20" | "28"; bg: "transparent" | "bg" | "bg-subtle" | "surface" };
  Columns: { cols: 2 | 3 | 4 };
};

export const config: Config<Props> = {
  categories: {
    marketing: {
      components: ["Hero", "CTASection", "LiveStatsStrip", "HowItWorks", "ChallengesPreview", "PlatformFeatures", "PayoutsSection", "Testimonials", "FAQSection"],
    },
    layout: {
      components: ["Section", "Columns"],
    },
    content: {
      components: ["Heading", "Text", "Button"],
    },
  },
  root: {
    render: ({ children }) => {
      return (
        <div className="min-h-screen bg-bg text-text transition-colors duration-200">
          {children}
        </div>
      );
    }
  },
  components: {
    Hero: {
      fields: {
        badge: { type: "text" },
        title: { type: "text" },
        highlight: { type: "text" },
        subtitle: { type: "textarea" },
      },
      defaultProps: {
        badge: "⚡ Next-Gen Institutional Funding • Scale up to $2,000,000",
        title: "Funded by Professionals.",
        highlight: "Built for Serious Traders.",
        subtitle: "Pass our low-target evaluation or trade directly with instant funding. Keep up to 90% of your profits with institutional Pepperstone spreads and bi-weekly crypto payouts.",
      },
      render: ({ title, highlight, subtitle, badge }) => (
        <Hero puckProps={{ title, highlight, subtitle, badge }} />
      ),
    },
    CTASection: {
      fields: {
        title: { type: "text" },
        highlight: { type: "text" },
        description: { type: "textarea" },
      },
      defaultProps: {
        title: "Ready to Trade Up to $2,000,000",
        highlight: "in Institutional Capital?",
        description: "Select your challenge tier today. Pass our fair evaluation, receive funded credentials instantly, and withdraw up to 90% of your profits bi-weekly.",
      },
      render: ({ title, highlight, description }) => (
        <CTASection puckProps={{ title, highlight, description }} />
      ),
    },
    LiveStatsStrip: {
      fields: {
        items: {
          type: "array",
          arrayFields: {
            label: { type: "text" },
            value: { type: "text" },
            subtext: { type: "text" },
          },
        },
      },
      defaultProps: {
        items: [],
      },
      render: ({ items }) => <LiveStatsStrip puckProps={{ items }} />,
    },
    HowItWorks: {
      fields: {
        badge: { type: "text" },
        titleText1: { type: "text" },
        titleAccent: { type: "text" },
        description: { type: "textarea" },
        steps: {
          type: "array",
          arrayFields: {
            n: { type: "text" },
            title: { type: "text" },
            body: { type: "textarea" },
            items: {
              type: "array",
              arrayFields: {
                itemText: { type: "text" }
              }
            }
          }
        }
      },
      defaultProps: {
        badge: "Evaluation Roadmap",
        titleText1: "Three simple steps to",
        titleAccent: "institutional capital",
        description: "A transparent, rule-first evaluation designed for disciplined traders. No hidden traps, no synthetic delays.",
        steps: [
          {
            n: '01',
            title: 'Select Your Capital Tier',
            body: 'Choose from $10,000 up to $200,000 account size. Clear evaluation targets (8% Phase 1, 5% Phase 2) with zero calendar time limits.',
            items: [{itemText: 'Zero Time Pressure'}, {itemText: 'Raw Pepperstone Spreads'}, {itemText: '1:100 Leverage'}],
          },
          {
            n: '02',
            title: 'Trade With Your Edge',
            body: 'Execute on MetaTrader 5 or WebTrader. News trading, Expert Advisors (EAs), and weekend holding are fully supported with static drawdown protection.',
            items: [{itemText: 'EAs & Algos Permitted'}, {itemText: 'News Trading Allowed'}, {itemText: 'Static Drawdown Floor'}],
          },
          {
            n: '03',
            title: 'Keep Up To 90% & Scale',
            body: 'Receive funded credentials instantly. Withdraw your profits bi-weekly via USDT TRC-20 or Bank Wire with your 100% evaluation fee refunded on first reward.',
            items: [{itemText: 'Up to 90% Profit Split'}, {itemText: '100% Fee Refund Included'}, {itemText: 'Bi-Weekly Disbursals'}],
          }
        ]
      },
      render: ({ badge, titleText1, titleAccent, description, steps }) => (
        <HowItWorks puckProps={{ badge, titleText1, titleAccent, description, steps }} />
      ),
    },
    ChallengesPreview: {
      fields: {
        title: { type: "text" }
      },
      defaultProps: {
        title: "Choose Your Capital Tier"
      },
      render: ({ title }) => <ChallengesPreview puckProps={{ title }} />,
    },
    PlatformFeatures: {
      fields: {
        titleText1: { type: "text" },
        titleAccent: { type: "text" },
        description: { type: "textarea" },
        features: {
          type: "array",
          arrayFields: {
            title: { type: "text" },
            body: { type: "textarea" }
          }
        }
      },
      defaultProps: {
        titleText1: "Engineered for",
        titleAccent: "Serious Trading",
        description: "A professional-grade prop trading ecosystem built with zero gimmicks, institutional execution, and complete trader protection.",
        features: [
          { title: 'Static Drawdown Floor',  body: 'Zero trailing floor traps. Floating profits are never used to drag up your loss limit.' },
          { title: 'MT5 & WebTrader Parity', body: 'Live 14ms execution bridge across MetaTrader 5 and browser WebTrader.' },
          { title: 'Bi-Weekly Payouts',      body: 'Guaranteed 24-hour disbursal via USDT TRC-20, ERC-20, BTC or Wire.' },
          { title: 'PvP Trading Arena',      body: 'Compete in 1v1 trading duels and monthly firm tournaments for cash & accounts.' },
          { title: 'AI Discipline Copilot',  body: 'Real-time danger zone alerts, lot sizing guidance, and trading journal metrics.' },
          { title: 'Raw 0.0 Pip Spreads',    body: 'Institutional Pepperstone liquidity with zero markup on major pairs.' },
          { title: 'EAs & News Permitted',   body: 'Complete strategic freedom without restrictive holding windows.' },
          { title: '100% Fee Refund',        body: 'Full evaluation fee returned with your very first successful profit withdrawal.' },
        ]
      },
      render: ({ titleText1, titleAccent, description, features }) => (
        <PlatformFeatures puckProps={{ titleText1, titleAccent, description, features }} />
      ),
    },
    PayoutsSection: {
      fields: {
        badge: { type: "text" },
        titleText1: { type: "text" },
        titleAccent: { type: "text" },
        description: { type: "textarea" },
        items: {
          type: "array",
          arrayFields: {
            itemText: { type: "text" }
          }
        }
      },
      defaultProps: {
        badge: "Disbursal SLA",
        titleText1: "Bi-Weekly Payouts in",
        titleAccent: "Under 24 Hours",
        description: "Request your first withdrawal 14 days after receiving your funded account, and bi-weekly thereafter. Zero withdrawal fees, flexible crypto and wire rails, and a 100% evaluation fee refund on your first payout.",
        items: [
          { itemText: 'Bi-weekly payout cycle — regular, predictable withdrawals' },
          { itemText: 'Crypto (USDT TRC-20, ERC-20, BTC) & Bank Wire supported' },
          { itemText: '100% Evaluation Fee Refund included with your very first payout' },
          { itemText: 'Profit split up to 90% with progressive scaling milestones' },
          { itemText: 'Guaranteed 24-hour processing SLA from request to blockchain confirmation' },
        ]
      },
      render: ({ badge, titleText1, titleAccent, description, items }) => (
        <PayoutsSection puckProps={{ badge, titleText1, titleAccent, description, items }} />
      ),
    },
    Testimonials: {
      fields: {
        badge: { type: "text" },
        titleText1: { type: "text" },
        titleAccent: { type: "text" },
        stories: {
          type: "array",
          arrayFields: {
            name: { type: "text" },
            role: { type: "text" },
            quote: { type: "textarea" },
            pnl: { type: "text" },
            account: { type: "text" },
          }
        }
      },
      defaultProps: {
        badge: "Trader stories",
        titleText1: "From challenge to",
        titleAccent: "first payout",
        stories: [],
      },
      render: ({ badge, titleText1, titleAccent, stories }) => (
        <Testimonials puckProps={{ badge, titleText1, titleAccent, stories }} />
      ),
    },
    FAQSection: {
      fields: {
        badge: { type: "text" },
        titleText1: { type: "text" },
        titleAccent: { type: "text" },
        description: { type: "textarea" },
        faqs: {
          type: "array",
          arrayFields: {
            q: { type: "text" },
            a: { type: "textarea" },
          },
        },
      },
      defaultProps: {
        badge: "Common questions",
        titleText1: "Frequently Asked",
        titleAccent: "Questions",
        description: "Everything you need to know about our evaluation process, rules, and payouts.",
        faqs: [
          {
            q: "How does the two-phase evaluation work?",
            a: "You choose an account size from $10,000 to $200,000. Complete Phase 1 with an 8% profit target, and Phase 2 with a 5% target, while respecting daily and total drawdown rules. Once passed, you are allocated a funded account to trade our capital."
          },
          {
            q: "When and how do I receive my payouts?",
            a: "Your first payout is eligible 14 days after your funded account is activated. Subsequent payouts occur on a bi-weekly schedule. Payouts are processed within 24 hours via Crypto (USDT) or direct bank transfer via Wise."
          },
          {
            q: "Are Expert Advisors (EAs) and news trading allowed?",
            a: "Yes, algorithmic trading, EAs, and trading during macroeconomic news releases are fully permitted across both evaluation and funded phases."
          },
          {
            q: "What are the drawdown and risk limits?",
            a: "The daily drawdown limit is 5% based on your daily starting equity/balance (resets at 00:00 UTC). The maximum total drawdown is a static 10% from your initial account balance."
          },
          {
            q: "What platforms and spreads do you provide?",
            a: "We offer full integration with MetaTrader 5 (MT5) and TradingView powered charts, with direct market execution and institutional raw spreads starting from 0.0 pips."
          }
        ],
      },
      render: ({ badge, titleText1, titleAccent, description, faqs }) => (
        <FAQSection puckProps={{ badge, titleText1, titleAccent, description, faqs }} />
      ),
    },
    Heading: {
      fields: {
        text: { type: "text" },
        size: {
          type: "select",
          options: [
            { label: "Small", value: "sm" },
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
            { label: "Extra Large", value: "xl" },
          ],
        },
        align: {
          type: "select",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
          ],
        },
      },
      defaultProps: { text: "Heading Text", size: "md", align: "left" },
      render: (props) => <HeadingBlock {...props} />,
    },
    Text: {
      fields: {
        text: { type: "textarea" },
        size: {
          type: "select",
          options: [
            { label: "Small", value: "sm" },
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
          ],
        },
        align: {
          type: "select",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
          ],
        },
      },
      defaultProps: { text: "Paragraph text goes here.", size: "md", align: "left" },
      render: (props) => <TextBlock {...props} />,
    },
    Button: {
      fields: {
        text: { type: "text" },
        url: { type: "text" },
        variant: {
          type: "select",
          options: [
            { label: "Primary", value: "primary" },
            { label: "Secondary", value: "secondary" },
            { label: "Outline", value: "outline" },
          ],
        },
      },
      defaultProps: { text: "Click Here", url: "#", variant: "primary" },
      render: (props) => <ButtonBlock {...props} />,
    },
    Section: {
      fields: {
        padding: {
          type: "select",
          options: [
            { label: "Small (10)", value: "10" },
            { label: "Medium (20)", value: "20" },
            { label: "Large (28)", value: "28" },
          ],
        },
        bg: {
          type: "select",
          options: [
            { label: "Transparent", value: "transparent" },
            { label: "Background", value: "bg" },
            { label: "Subtle", value: "bg-subtle" },
            { label: "Surface", value: "surface" },
          ],
        },
      },
      defaultProps: { padding: "20", bg: "transparent" },
      render: (props) => <SectionBlock {...props} />,
    },
    Columns: {
      fields: {
        cols: {
          type: "select",
          options: [
            { label: "2 Columns", value: 2 as any },
            { label: "3 Columns", value: 3 as any },
            { label: "4 Columns", value: 4 as any },
          ],
        },
      },
      defaultProps: { cols: 2 },
      render: (props) => <ColumnsBlock {...props} />,
    },
  },
};
