import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

const API_URL = 'https://stockwise-pro-api.onrender.com/api';
const theme = {
  background: '#0a0a0a',
  card: '#141414',
  text: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.6)',
  gold: '#c9a962',
  green: '#22c55e',
  red: '#ef4444',
  border: 'rgba(255,255,255,0.1)',
};

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  marketCap: number;
  volume: number;
  score?: number;
  recommendation?: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
}

export default function ScreenerScreen({ navigation }: any) {
  const { isAuthenticated } = useAuth();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'gainers' | 'losers' | 'scored'>('all');

  const fetchStocks = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/stocks/trending`);
      const data = await response.json();
      
      // Add mock scores for demo
      const stocksWithScores = data.map((stock: Stock) => ({
        ...stock,
        score: Math.floor(Math.random() * 40) + 60, // 60-100
        recommendation: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL'][Math.floor(Math.random() * 4)],
      }));
      
      setStocks(stocksWithScores);
      setFilteredStocks(stocksWithScores);
    } catch (error) {
      console.error('Error fetching stocks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  useEffect(() => {
    let filtered = stocks;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (stock) =>
          stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          stock.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Category filter
    switch (selectedFilter) {
      case 'gainers':
        filtered = filtered.filter((s) => s.change > 0);
        break;
      case 'losers':
        filtered = filtered.filter((s) => s.change < 0);
        break;
      case 'scored':
        filtered = filtered.filter((s) => (s.score || 0) >= 70);
        break;
    }

    setFilteredStocks(filtered);
  }, [searchQuery, selectedFilter, stocks]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStocks();
    setRefreshing(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatMarketCap = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value}`;
  };

  const getRecommendationColor = (rec?: string) => {
    switch (rec) {
      case 'STRONG_BUY':
        return theme.green;
      case 'BUY':
        return '#4ade80';
      case 'HOLD':
        return theme.gold;
      case 'SELL':
        return '#f87171';
      case 'STRONG_SELL':
        return theme.red;
      default:
        return theme.textSecondary;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return theme.green;
    if (score >= 60) return theme.gold;
    return theme.red;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Stock Screener</Text>
        <Text style={styles.subtitle}>Find your next investment</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search stocks..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        {(['all', 'gainers', 'losers', 'scored'] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterChip, selectedFilter === filter && styles.filterChipActive]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedFilter === filter && styles.filterChipTextActive,
              ]}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results */}
      <ScrollView
        style={styles.resultsContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />
        }
      >
        <Text style={styles.resultsCount}>
          {filteredStocks.length} stocks found
        </Text>

        {filteredStocks.map((stock) => (
          <TouchableOpacity
            key={stock.symbol}
            style={styles.stockCard}
            onPress={() => navigation.navigate('StockDetail', { ticker: stock.symbol })}
          >
            <View style={styles.stockHeader}>
              <View style={styles.stockInfo}>
                <View style={styles.stockIcon}>
                  <Text style={styles.stockIconText}>{stock.symbol[0]}</Text>
                </View>
                <View>
                  <Text style={styles.stockSymbol}>{stock.symbol}</Text>
                  <Text style={styles.stockName} numberOfLines={1}>
                    {stock.name}
                  </Text>
                </View>
              </View>
              {stock.score && (
                <View style={[styles.scoreBadge, { backgroundColor: `${getScoreColor(stock.score)}20` }]}>
                  <Text style={[styles.scoreText, { color: getScoreColor(stock.score) }]}>
                    {stock.score}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.stockDetails}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Price</Text>
                <Text style={styles.detailValue}>{formatCurrency(stock.price)}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Change</Text>
                <Text
                  style={[
                    styles.detailValue,
                    { color: stock.change >= 0 ? theme.green : theme.red },
                  ]}
                >
                  {formatPercentage(stock.changesPercentage)}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Market Cap</Text>
                <Text style={styles.detailValue}>{formatMarketCap(stock.marketCap)}</Text>
              </View>
            </View>

            {stock.recommendation && (
              <View style={styles.recommendationContainer}>
                <View
                  style={[
                    styles.recommendationBadge,
                    { backgroundColor: `${getRecommendationColor(stock.recommendation)}20` },
                  ]}
                >
                  <Text
                    style={[
                      styles.recommendationText,
                      { color: getRecommendationColor(stock.recommendation) },
                    ]}
                  >
                    {stock.recommendation.replace('_', ' ')}
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    color: theme.text,
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: 16,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchInput: {
    flex: 1,
    color: theme.text,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  filtersContainer: {
    maxHeight: 60,
    marginTop: 12,
  },
  filtersContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: theme.gold,
    borderColor: theme.gold,
  },
  filterChipText: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: theme.background,
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  resultsCount: {
    color: theme.textSecondary,
    fontSize: 14,
    marginVertical: 12,
  },
  stockCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  stockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stockIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: `${theme.gold}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stockIconText: {
    color: theme.gold,
    fontSize: 18,
    fontWeight: 'bold',
  },
  stockSymbol: {
    color: theme.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  stockName: {
    color: theme.textSecondary,
    fontSize: 13,
    maxWidth: 180,
  },
  scoreBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  stockDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  detailValue: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  recommendationContainer: {
    marginTop: 12,
    alignItems: 'flex-start',
  },
  recommendationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  recommendationText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
