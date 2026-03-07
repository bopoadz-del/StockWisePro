import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, ArrowUpDown, ChevronDown, ChevronUp, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { mockStocks, sectors } from '@/lib/data';
import { formatCurrency, formatPercentage, getScoreColor } from '@/lib/utils';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SignalBadge } from '@/components/SignalBadge';
import { ScoreVisualizer } from '@/components/ScoreVisualizer';
import { SparklineChart } from '@/components/SparklineChart';
import { toast } from 'sonner';

type SortField = 'ticker' | 'price' | 'change' | 'score' | 'marketCap';
type SortDirection = 'asc' | 'desc';

interface StockResult {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
  score: number;
  signal: 'buy' | 'hold' | 'sell';
  sector?: string;
  sparklineData?: number[];
}

interface StockScreenerProps {
  onSelectStock: (ticker: string) => void;
  isAuthenticated?: boolean;
}

// Extended mock data for demo (simulating more US stocks)
const extendedMockStocks: StockResult[] = [
  ...mockStocks,
  { ticker: 'NFLX', name: 'Netflix Inc.', price: 485.32, change: 8.45, changePercent: 1.77, marketCap: 215000000000, score: 76, signal: 'buy', sector: 'Communication', sparklineData: [475, 478, 476, 480, 479, 482, 481, 484, 483, 485.32] },
  { ticker: 'DIS', name: 'Walt Disney Co.', price: 112.45, change: -1.23, changePercent: -1.08, marketCap: 205000000000, score: 68, signal: 'hold', sector: 'Communication', sparklineData: [115, 114, 114, 113, 114, 113, 113, 112, 113, 112.45] },
  { ticker: 'UBER', name: 'Uber Technologies', price: 78.92, change: 2.15, changePercent: 2.8, marketCap: 165000000000, score: 72, signal: 'buy', sector: 'Technology', sparklineData: [76, 77, 76, 77, 78, 77, 78, 79, 78, 78.92] },
  { ticker: 'PYPL', name: 'PayPal Holdings', price: 68.45, change: -0.85, changePercent: -1.23, marketCap: 72000000000, score: 58, signal: 'hold', sector: 'Financials', sparklineData: [70, 69, 69, 68, 69, 68, 68, 69, 68, 68.45] },
  { ticker: 'INTC', name: 'Intel Corporation', price: 42.18, change: -0.32, changePercent: -0.75, marketCap: 180000000000, score: 52, signal: 'hold', sector: 'Technology', sparklineData: [43, 42.8, 42.5, 42.3, 42.5, 42.2, 42.4, 42.1, 42.3, 42.18] },
  { ticker: 'AMD', name: 'Advanced Micro Devices', price: 145.82, change: 3.45, changePercent: 2.42, marketCap: 235000000000, score: 74, signal: 'buy', sector: 'Technology', sparklineData: [141, 142, 141.5, 143, 142.5, 144, 143.5, 145, 144.5, 145.82] },
  { ticker: 'CRM', name: 'Salesforce Inc.', price: 278.45, change: 4.12, changePercent: 1.5, marketCap: 270000000000, score: 71, signal: 'buy', sector: 'Technology', sparklineData: [273, 274, 273.5, 275, 274.5, 276, 275.5, 277, 276.5, 278.45] },
  { ticker: 'BAC', name: 'Bank of America', price: 35.82, change: 0.45, changePercent: 1.27, marketCap: 280000000000, score: 78, signal: 'buy', sector: 'Financials', sparklineData: [35.3, 35.5, 35.4, 35.6, 35.5, 35.7, 35.6, 35.8, 35.7, 35.82] },
  { ticker: 'PFE', name: 'Pfizer Inc.', price: 28.45, change: -0.22, changePercent: -0.77, marketCap: 160000000000, score: 62, signal: 'hold', sector: 'Healthcare', sparklineData: [28.8, 28.7, 28.6, 28.5, 28.6, 28.5, 28.4, 28.5, 28.4, 28.45] },
  { ticker: 'KO', name: 'Coca-Cola Co.', price: 62.18, change: 0.35, changePercent: 0.57, marketCap: 268000000000, score: 81, signal: 'buy', sector: 'Consumer Defensive', sparklineData: [61.8, 61.9, 61.85, 62, 61.95, 62.1, 62.05, 62.15, 62.1, 62.18] },
  { ticker: 'PEP', name: 'PepsiCo Inc.', price: 175.42, change: 1.25, changePercent: 0.72, marketCap: 241000000000, score: 79, signal: 'buy', sector: 'Consumer Defensive', sparklineData: [174, 174.3, 174.2, 174.6, 174.5, 174.9, 174.8, 175.2, 175.1, 175.42] },
  { ticker: 'MCD', name: "McDonald's Corp", price: 295.68, change: 2.85, changePercent: 0.97, marketCap: 215000000000, score: 84, signal: 'buy', sector: 'Consumer Cyclical', sparklineData: [291, 292, 291.5, 293, 292.5, 294, 293.5, 295, 294.5, 295.68] },
  { ticker: 'NKE', name: 'Nike Inc.', price: 98.45, change: -1.12, changePercent: -1.13, marketCap: 148000000000, score: 66, signal: 'hold', sector: 'Consumer Cyclical', sparklineData: [100, 99.6, 99.3, 98.9, 98.6, 98.2, 97.9, 98.3, 97.9, 98.45] },
  { ticker: 'XOM', name: 'Exxon Mobil', price: 115.82, change: 1.45, changePercent: 1.27, marketCap: 460000000000, score: 73, signal: 'buy', sector: 'Energy', sparklineData: [114.2, 114.5, 114.3, 114.8, 114.6, 115.1, 114.9, 115.4, 115.2, 115.82] },
  { ticker: 'CVX', name: 'Chevron Corporation', price: 152.35, change: 1.85, changePercent: 1.23, marketCap: 290000000000, score: 75, signal: 'buy', sector: 'Energy', sparklineData: [150.3, 150.7, 150.5, 151, 150.8, 151.3, 151.1, 151.6, 151.4, 152.35] },
  { ticker: 'UNH', name: 'UnitedHealth Group', price: 485.92, change: 6.45, changePercent: 1.35, marketCap: 450000000000, score: 87, signal: 'buy', sector: 'Healthcare', sparklineData: [478, 479.5, 478.8, 480.2, 479.5, 481, 480.3, 482.5, 481.8, 485.92] },
  { ticker: 'ABBV', name: 'AbbVie Inc.', price: 168.25, change: 2.15, changePercent: 1.29, marketCap: 297000000000, score: 82, signal: 'buy', sector: 'Healthcare', sparklineData: [165.8, 166.3, 166, 166.6, 166.3, 166.9, 166.6, 167.3, 167, 168.25] },
  { ticker: 'TMO', name: 'Thermo Fisher Scientific', price: 575.48, change: 8.32, changePercent: 1.47, marketCap: 222000000000, score: 85, signal: 'buy', sector: 'Healthcare', sparklineData: [565, 567, 566, 568, 567, 569, 568, 571, 570, 575.48] },
  { ticker: 'COST', name: 'Costco Wholesale', price: 685.92, change: 9.45, changePercent: 1.4, marketCap: 304000000000, score: 88, signal: 'buy', sector: 'Consumer Defensive', sparklineData: [674, 676, 675, 678, 677, 680, 679, 682, 681, 685.92] },
  { ticker: 'AVGO', name: 'Broadcom Inc.', price: 1285.45, change: 22.15, changePercent: 1.75, marketCap: 595000000000, score: 83, signal: 'buy', sector: 'Technology', sparklineData: [1260, 1265, 1262, 1270, 1267, 1275, 1272, 1280, 1277, 1285.45] },
  { ticker: 'TXN', name: 'Texas Instruments', price: 198.32, change: 2.85, changePercent: 1.46, marketCap: 180000000000, score: 77, signal: 'buy', sector: 'Technology', sparklineData: [194.5, 195.5, 195, 196.2, 195.7, 196.8, 196.3, 197.5, 197, 198.32] },
  { ticker: 'QCOM', name: 'Qualcomm Inc.', price: 168.92, change: 3.45, changePercent: 2.09, marketCap: 188000000000, score: 76, signal: 'buy', sector: 'Technology', sparklineData: [164.5, 165.5, 165, 166.5, 166, 167.5, 167, 168, 167.5, 168.92] },
  { ticker: 'HON', name: 'Honeywell International', price: 198.45, change: 2.35, changePercent: 1.2, marketCap: 132000000000, score: 78, signal: 'buy', sector: 'Industrials', sparklineData: [195, 195.8, 195.4, 196.2, 195.9, 196.7, 196.3, 197.2, 196.8, 198.45] },
  { ticker: 'UNP', name: 'Union Pacific', price: 245.82, change: 3.15, changePercent: 1.3, marketCap: 150000000000, score: 80, signal: 'buy', sector: 'Industrials', sparklineData: [241.5, 242.5, 242, 243.2, 242.7, 244, 243.5, 244.8, 244.3, 245.82] },
  { ticker: 'RTX', name: 'RTX Corporation', price: 85.45, change: 0.95, changePercent: 1.12, marketCap: 112000000000, score: 74, signal: 'buy', sector: 'Industrials', sparklineData: [84.3, 84.6, 84.45, 84.8, 84.65, 85, 84.85, 85.2, 85.05, 85.45] },
  { ticker: 'LMT', name: 'Lockheed Martin', price: 448.92, change: 5.85, changePercent: 1.32, marketCap: 110000000000, score: 79, signal: 'buy', sector: 'Industrials', sparklineData: [441, 443, 442, 444, 443, 445, 444, 446, 445, 448.92] },
  { ticker: 'NEE', name: 'NextEra Energy', price: 68.45, change: 0.75, changePercent: 1.11, marketCap: 141000000000, score: 76, signal: 'buy', sector: 'Utilities', sparklineData: [67.5, 67.8, 67.65, 68, 67.85, 68.2, 68.05, 68.35, 68.2, 68.45] },
  { ticker: 'DUK', name: 'Duke Energy', price: 102.18, change: 1.25, changePercent: 1.24, marketCap: 79000000000, score: 75, signal: 'buy', sector: 'Utilities', sparklineData: [100.8, 101.2, 101, 101.5, 101.3, 101.8, 101.6, 102, 101.8, 102.18] },
  { ticker: 'PLD', name: 'Prologis Inc.', price: 125.42, change: 1.85, changePercent: 1.5, marketCap: 116000000000, score: 73, signal: 'buy', sector: 'Real Estate', sparklineData: [123.2, 123.7, 123.45, 124, 123.75, 124.3, 124.05, 124.6, 124.35, 125.42] },
  { ticker: 'AMT', name: 'American Tower', price: 218.65, change: 3.25, changePercent: 1.51, marketCap: 102000000000, score: 71, signal: 'buy', sector: 'Real Estate', sparklineData: [214, 215, 214.5, 215.5, 215, 216.5, 216, 217, 216.5, 218.65] },
  { ticker: 'LIN', name: 'Linde plc', price: 425.88, change: 5.45, changePercent: 1.3, marketCap: 208000000000, score: 82, signal: 'buy', sector: 'Materials', sparklineData: [419, 420.5, 420, 421.5, 421, 422.5, 422, 423.5, 423, 425.88] },
  { ticker: 'APD', name: 'Air Products', price: 268.32, change: 3.15, changePercent: 1.19, marketCap: 60000000000, score: 78, signal: 'buy', sector: 'Materials', sparklineData: [264.5, 265.5, 265, 266, 265.5, 266.5, 266, 267, 266.5, 268.32] },
  { ticker: 'FCX', name: 'Freeport-McMoRan', price: 45.82, change: 0.95, changePercent: 2.12, marketCap: 66000000000, score: 69, signal: 'hold', sector: 'Materials', sparklineData: [44.7, 45, 44.85, 45.2, 45.05, 45.4, 45.25, 45.6, 45.45, 45.82] },
  { ticker: 'T', name: 'AT&T Inc.', price: 17.85, change: 0.15, changePercent: 0.85, marketCap: 128000000000, score: 65, signal: 'hold', sector: 'Communication', sparklineData: [17.6, 17.7, 17.65, 17.75, 17.7, 17.8, 17.75, 17.85, 17.8, 17.85] },
  { ticker: 'VZ', name: 'Verizon Communications', price: 42.18, change: 0.42, changePercent: 1.01, marketCap: 177000000000, score: 70, signal: 'buy', sector: 'Communication', sparklineData: [41.7, 41.85, 41.78, 41.95, 41.88, 42.05, 41.98, 42.12, 42.05, 42.18] },
  { ticker: 'CHTR', name: 'Charter Communications', price: 385.42, change: 5.85, changePercent: 1.54, marketCap: 55000000000, score: 72, signal: 'buy', sector: 'Communication', sparklineData: [378, 380, 379, 381, 380, 382, 381, 383, 382, 385.42] },
  { ticker: 'GM', name: 'General Motors', price: 45.28, change: 0.85, changePercent: 1.91, marketCap: 52000000000, score: 71, signal: 'buy', sector: 'Consumer Cyclical', sparklineData: [44.3, 44.6, 44.45, 44.8, 44.65, 45, 44.85, 45.15, 45, 45.28] },
  { ticker: 'F', name: 'Ford Motor Co.', price: 12.15, change: 0.22, changePercent: 1.85, marketCap: 49000000000, score: 64, signal: 'hold', sector: 'Consumer Cyclical', sparklineData: [11.85, 11.95, 11.9, 12, 11.95, 12.05, 12, 12.1, 12.05, 12.15] },
  { ticker: 'STLA', name: 'Stellantis NV', price: 28.45, change: 0.55, changePercent: 1.97, marketCap: 88000000000, score: 73, signal: 'buy', sector: 'Consumer Cyclical', sparklineData: [27.8, 28, 27.9, 28.15, 28.05, 28.25, 28.15, 28.3, 28.2, 28.45] },
  { ticker: 'COP', name: 'ConocoPhillips', price: 112.85, change: 1.65, changePercent: 1.48, marketCap: 130000000000, score: 76, signal: 'buy', sector: 'Energy', sparklineData: [110.8, 111.3, 111.05, 111.55, 111.3, 111.8, 111.55, 112.1, 111.85, 112.85] },
  { ticker: 'EOG', name: 'EOG Resources', price: 128.42, change: 1.92, changePercent: 1.52, marketCap: 74000000000, score: 77, signal: 'buy', sector: 'Energy', sparklineData: [126, 126.5, 126.25, 126.85, 126.6, 127.15, 126.9, 127.5, 127.25, 128.42] },
  { ticker: 'SLB', name: 'Schlumberger', price: 52.18, change: 0.78, changePercent: 1.52, marketCap: 75000000000, score: 72, signal: 'buy', sector: 'Energy', sparklineData: [51.3, 51.55, 51.42, 51.7, 51.55, 51.85, 51.7, 51.95, 51.8, 52.18] },
];

export function StockScreener({ onSelectStock, isAuthenticated: _isAuthenticated }: StockScreenerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Filter stocks based on search and sector
  const filteredStocks = useMemo(() => {
    let result = [...extendedMockStocks];

    // Search filter (searches all extended stocks - simulating full market)
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (stock) =>
          stock.ticker.toLowerCase().includes(query) ||
          stock.name.toLowerCase().includes(query)
      );
    }

    // Sector filter
    if (selectedSector) {
      result = result.filter((stock) => stock.sector === selectedSector);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'ticker':
          comparison = a.ticker.localeCompare(b.ticker);
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'change':
          comparison = a.changePercent - b.changePercent;
          break;
        case 'score':
          comparison = a.score - b.score;
          break;
        case 'marketCap':
          comparison = a.marketCap - b.marketCap;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [searchQuery, selectedSector, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedSector(null);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="text-white/30" />;
    return sortDirection === 'asc' ? (
      <ChevronUp size={14} className="text-gold" />
    ) : (
      <ChevronDown size={14} className="text-gold" />
    );
  };

  return (
    <section id="screener" className="py-20 bg-[#0a0a0a]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Stock <span className="text-gradient-gold">Screener</span>
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              Search over 50+ major US stocks in real-time. Filter by sector,
              valuation, and our proprietary AI score.
            </p>
          </div>
        </ScrollReveal>

        {/* Search and Filters */}
        <ScrollReveal delay={0.1}>
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
              <Input
                placeholder="Search any US stock (e.g., AAPL, Tesla, Netflix)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-10 h-12 bg-[#141414] border-white/10 text-white placeholder:text-white/40 focus:border-gold focus:ring-gold/20"
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`h-12 px-6 border-white/20 text-white hover:bg-white/10 ${
                showFilters ? 'bg-white/10 border-gold' : ''
              }`}
            >
              <Filter size={18} className="mr-2" />
              Filters
              {(selectedSector) && (
                <Badge variant="secondary" className="ml-2 bg-gold text-[#0a0a0a]">
                  {[selectedSector].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </div>
        </ScrollReveal>

        {/* Search Results Info */}
        <AnimatePresence>
          {searchQuery && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              <div className="flex items-center justify-between bg-[#141414] rounded-lg px-4 py-3 border border-white/10">
                <span className="text-white/70">
                  Found <span className="text-gold font-semibold">{filteredStocks.length}</span> results for &quot;{searchQuery}&quot;
                </span>
                <button
                  onClick={handleClearSearch}
                  className="text-sm text-white/50 hover:text-white transition-colors"
                >
                  Clear search
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter Panel */}
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-6 p-4 bg-[#141414] rounded-xl border border-white/10"
          >
            <div className="flex flex-wrap gap-2">
              <span className="text-white/60 text-sm py-2">Sector:</span>
              <button
                onClick={() => setSelectedSector(null)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  !selectedSector
                    ? 'bg-gold text-[#0a0a0a] font-medium'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                All
              </button>
              {sectors.map((sector) => (
                <button
                  key={sector}
                  onClick={() => setSelectedSector(sector)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    selectedSector === sector
                      ? 'bg-gold text-[#0a0a0a] font-medium'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {sector}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Results Table */}
        <ScrollReveal delay={0.2}>
          <div className="bg-[#141414] rounded-xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/60">
                      <button
                        onClick={() => handleSort('ticker')}
                        className="flex items-center gap-2 hover:text-white transition-colors"
                      >
                        Stock
                        <SortIcon field="ticker" />
                      </button>
                    </TableHead>
                    <TableHead className="text-white/60 text-right">
                      <button
                        onClick={() => handleSort('price')}
                        className="flex items-center justify-end gap-2 hover:text-white transition-colors w-full"
                      >
                        Price
                        <SortIcon field="price" />
                      </button>
                    </TableHead>
                    <TableHead className="text-white/60 text-right">
                      <button
                        onClick={() => handleSort('change')}
                        className="flex items-center justify-end gap-2 hover:text-white transition-colors w-full"
                      >
                        Change
                        <SortIcon field="change" />
                      </button>
                    </TableHead>
                    <TableHead className="text-white/60 hidden md:table-cell">Chart</TableHead>
                    <TableHead className="text-white/60 text-right">
                      <button
                        onClick={() => handleSort('score')}
                        className="flex items-center justify-end gap-2 hover:text-white transition-colors w-full"
                      >
                        Score
                        <SortIcon field="score" />
                      </button>
                    </TableHead>
                    <TableHead className="text-white/60 text-center">Signal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStocks.map((stock, index) => (
                    <motion.tr
                      key={stock.ticker}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => onSelectStock(stock.ticker)}
                      className="border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                            <span className="text-white font-bold text-sm">{stock.ticker[0]}</span>
                          </div>
                          <div>
                            <div className="font-semibold text-white">{stock.ticker}</div>
                            <div className="text-white/50 text-sm">{stock.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-white">
                          {formatCurrency(stock.price)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className={`font-mono ${
                            stock.change >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}
                        >
                          <div>{stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}</div>
                          <div className="text-sm">{formatPercentage(stock.changePercent)}</div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="w-24">
                          <SparklineChart
                            data={stock.sparklineData || []}
                            isPositive={stock.change >= 0}
                            height={30}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <ScoreVisualizer score={stock.score} size="sm" showLabel={false} />
                          <span className={`font-bold ${getScoreColor(stock.score)}`}>
                            {stock.score}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <SignalBadge signal={stock.signal} size="sm" />
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredStocks.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-white/50">
                  No stocks found matching &quot;{searchQuery}&quot;
                </p>
                <Button
                  variant="ghost"
                  onClick={handleClearSearch}
                  className="mt-4 text-gold hover:text-gold-light"
                >
                  Clear Search
                </Button>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
