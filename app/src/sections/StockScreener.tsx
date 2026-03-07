import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, ArrowUpDown, ChevronDown, ChevronUp, X } from 'lucide-react';
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
// Types are handled implicitly through the mockStocks data

type SortField = 'ticker' | 'price' | 'change' | 'score' | 'marketCap';
type SortDirection = 'asc' | 'desc';

interface StockScreenerProps {
  onSelectStock: (ticker: string) => void;
  isAuthenticated?: boolean;
}

export function StockScreener({ onSelectStock, isAuthenticated: _isAuthenticated }: StockScreenerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showFilters, setShowFilters] = useState(false);

  const filteredStocks = useMemo(() => {
    let result = [...mockStocks];

    // Search filter
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
              Discover top-rated stocks with our advanced screening tools. Filter by sector,
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
                placeholder="Search by ticker or company name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-10 h-12 bg-[#141414] border-white/10 text-white placeholder:text-white/40 focus:border-gold focus:ring-gold/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
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
                      transition={{ delay: index * 0.05 }}
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
                        <span className="font-mono text-white">{formatCurrency(stock.price)}</span>
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
                            data={stock.sparklineData}
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
                <p className="text-white/50">No stocks match your criteria</p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedSector(null);
                  }}
                  className="mt-4 text-gold hover:text-gold-light"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
