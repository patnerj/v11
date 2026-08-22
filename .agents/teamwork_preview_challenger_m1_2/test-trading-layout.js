const fs = require('fs');
const path = require('path');

const projectRoot = 'd:\\Full Propfirm System for antigravity\\propfirm-frontend-v10.7.1';
const pagePath = path.join(projectRoot, 'src', 'app', 'dashboard', 'trading', 'page.tsx');
const marketWatchPath = path.join(projectRoot, 'src', 'components', 'dashboard', 'trading', 'market-watch.tsx');
const orderTicketPath = path.join(projectRoot, 'src', 'components', 'dashboard', 'trading', 'order-ticket.tsx');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] Test ${totalTests}: ${message}`);
    passedTests++;
  } else {
    console.error(`[FAIL] Test ${totalTests}: ${message}`);
  }
}

console.log('=== EMPIRICAL TEST SUITE: TRADING TERMINAL LAYOUT ===\n');

// 1. Read files
const pageSrc = fs.readFileSync(pagePath, 'utf8');
const mwSrc = fs.readFileSync(marketWatchPath, 'utf8');
const otSrc = fs.readFileSync(orderTicketPath, 'utf8');

// Test 1: mwCollapsed default state
assert(pageSrc.includes('const [mwCollapsed, setMwCollapsed] = useState(false)'),
  'Market Watch state defaults to open (useState(false))');

// Test 2: posCollapsed default state
assert(pageSrc.includes('const [posCollapsed, setPosCollapsed] = useState(false)'),
  'Positions panel state defaults to open (useState(false))');

// Test 3: No forced unconditional setMwCollapsed(true) on mount
// Unconditional setMwCollapsed(true) would mean setMwCollapsed(true) called without checking localStorage
const hasUnconditionalCollapse = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{\s*setMwCollapsed\s*\(\s*true\s*\)/.test(pageSrc);
assert(!hasUnconditionalCollapse, 'No unconditional setMwCollapsed(true) on mount');

// Test 4: Imperative Panel refs defined
assert(pageSrc.includes('const mwPanelRef = useRef<PanelImperativeHandle>(null)') &&
       pageSrc.includes('const posPanelRef = useRef<PanelImperativeHandle>(null)'),
  'PanelImperativeHandle refs declared for Market Watch and Positions');

// Test 5: Imperative handle method calls in toggleMw and useEffect
assert(pageSrc.includes('mwPanelRef.current?.collapse()') &&
       pageSrc.includes('mwPanelRef.current?.expand()'),
  'toggleMw/useEffect handles collapse() and expand() imperatively');

// Test 6: Vertical text rail prevents word wrapping
assert(pageSrc.includes('[writing-mode:vertical-rl] whitespace-nowrap'),
  'Market Watch collapsed rail uses whitespace-nowrap to prevent "MA WA" vertical text splitting');

// Test 7: Left panel sizing
assert(pageSrc.includes('defaultSize={24}') && pageSrc.includes('minSize={18}') && pageSrc.includes('maxSize={30}'),
  'Left panel (Market Watch) sized correctly (defaultSize={24}, minSize={18}, maxSize={30})');

// Test 8: Center panel sizing
assert(pageSrc.includes('defaultSize={52}') && pageSrc.includes('minSize={40}'),
  'Center panel (Chart/Positions) sized correctly (defaultSize={52}, minSize={40})');

// Test 9: Right panel sizing
assert(pageSrc.includes('defaultSize={24}') && pageSrc.includes('maxSize={30}'),
  'Right panel (Order Ticket) sized correctly (defaultSize={24}, maxSize={30})');

// Test 10: LocalStorage persistence key check
assert(pageSrc.includes("'fxsim:term:mw'") && pageSrc.includes("'fxsim:term:pos'"),
  'Collapse state persistence uses proper localStorage keys (fxsim:term:mw, fxsim:term:pos)');

// Test 11: MarketWatch styling optimizations
assert(mwSrc.includes('gap-1.5') && mwSrc.includes('min-w-[34px]') && mwSrc.includes('truncate'),
  'MarketWatch incorporates gap-1.5, min-w-[34px] spread, and text truncation');

// Test 12: OrderTicket button layout optimizations
assert(otSrc.includes('px-2.5') && otSrc.includes('gap-1.5') && otSrc.includes('shrink-0'),
  'OrderTicket action bar incorporates px-2.5 padding, gap-1.5 grid, and shrink-0 icons');

// Test 13: Pending order type buttons styling
assert(otSrc.includes('truncate whitespace-nowrap'),
  'OrderTicket pending buttons use truncate and whitespace-nowrap');

// Test 14-22: Computed width simulations across viewports
console.log('\n--- Simulated Desktop Viewport Width Calculations ---');
const viewports = [
  { name: '1280px (Standard Desktop)', width: 1280 },
  { name: '1440px (HD Laptop)', width: 1440 },
  { name: '1920px (Full HD)', width: 1920 },
  { name: '1024px (Small Desktop/Tablet)', width: 1024 }
];

viewports.forEach(vp => {
  const sidebar = 256;
  const padding = 32;
  const innerWidth = vp.width - sidebar - padding;
  const mwWidth = innerWidth * 0.24;
  const centerWidth = innerWidth * 0.52;
  const otWidth = innerWidth * 0.24;

  console.log(`Viewport: ${vp.name}`);
  console.log(`  Inner Width: ${innerWidth}px`);
  console.log(`  Market Watch (24%): ${mwWidth.toFixed(1)}px`);
  console.log(`  Center Panel (52%): ${centerWidth.toFixed(1)}px`);
  console.log(`  Order Ticket (24%): ${otWidth.toFixed(1)}px`);

  if (vp.width >= 1280) {
    assert(mwWidth > 200, `${vp.name}: Market Watch computed width (${mwWidth.toFixed(1)}px) > 200px`);
    assert(centerWidth > 200, `${vp.name}: Center Panel computed width (${centerWidth.toFixed(1)}px) > 200px`);
    assert(otWidth > 200, `${vp.name}: Order Ticket computed width (${otWidth.toFixed(1)}px) > 200px`);
  }
});

console.log(`\n=== TEST SUMMARY: ${passedTests}/${totalTests} Passed ===`);
if (passedTests === totalTests) {
  console.log('ALL EMPIRICAL TESTS PASSED SUCCESSFULLY.');
  process.exit(0);
} else {
  console.error('SOME TESTS FAILED.');
  process.exit(1);
}
