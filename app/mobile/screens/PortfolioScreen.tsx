import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const screenWidth = Dimensions.get('window').width;

interface Portfolio {
  totalValue: number;
  totalReturn: number;
  totalReturnPercentage: number;
  holdings: Holding[];
}

interface Holding {
  ticker: string;
  name: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  value: number;
  return: number;
  returnPercentage: number;
  allocation: number;
}

export default function PortfolioScreen({ navigation }: any) {
  const { isAuthenticated, user } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'holdings'>('overview');

  const fetchPortfolio = async () => {
    try {
      if (isAuthenticated && user) {
        const token = await AsyncStorage.getItem('auth-token');
        const response = await fetch(`${API_URL}/portfolio`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setPortfolio(data);
        }
      } else {
        // Demo portfolio for guests
        setPortfolio({
          totalValue: 125430.5,
          totalReturn: 15430.5,
          totalReturnPercentage: 14.03,
          holdings: [
            {
              ticker: 'AAPL',
              name: 'Apple Inc.',
              shares: 50,
              avgPrice: 150.0,
              currentPrice: 185.92,
              value: 9296.0,
              return: 1796.0,
              returnPercentage: 23.95,
              allocation: 7.41,
            },
            {
              ticker: 'MSFT',
              name: 'Microsoft Corp.',
              shares: 25,
              avgPrice: 280.0,
              currentPrice: 378.91,
              value: 9472.75,
              return: 2472.75,
              returnPercentage: 35.32,
              allocation: 7.55,
            },
            {
              ticker: 'NVDA',
              name: 'NVIDIA Corp.',
              shares: 30,
              avgPrice: 350.0,
              currentPrice: 495.22,
              value: 14856.6,
              return: 4356.6,
              returnPercentage: 41.49,
              allocation: 11.84,
            },
            {
              ticker: 'GOOGL',
              name: 'Alphabet Inc.',
              shares: 40,
              avgPrice: 120.0,
              currentPrice: 141.8,
              value: 5672.0,
              return: 872.0,
              returnPercentage: 18.17,
              allocation: 4.52,
            },
            {
              ticker: 'AMZN',
              name: 'Amazon.com Inc.',
              shares: 35,
              avgPrice: 130.0,
              currentPrice: 155.33,
              value: 5436.55,
              return: 886.55,
              returnPercentage: 19.48,
              allocation: 4.33,
            },
          ],
        });
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, [isAuthenticated, user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPortfolio();
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.gold} />
      </View>
    );
  }

  if (!portfolio) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Portfolio</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="pie-chart-outline" size={64} color={theme.textSecondary} />
          <Text style={styles.emptyTitle}>No Portfolio Data</Text>
          <Text style={styles.emptySubtitle}>Sign in to view your portfolio</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Portfolio</Text>
        <View style={styles.totalValueContainer}>
          <Text style={styles.totalValue}>{formatCurrency(portfolio.totalValue)}</Text>
          <View style={styles.returnContainer}>
            <Ionicons
              name={portfolio.totalReturn >= 0 ? 'trending-up' : 'trending-down'}
              size={16}
              color={portfolio.totalReturn >= 0 ? theme.green : theme.red}
            />
            <Text
              style={[
                styles.returnText,
                { color: portfolio.totalReturn >= 0 ? theme.green : theme.red },
              ]}
            >
              {formatCurrency(portfolio.totalReturn)} ({formatPercentage(portfolio.totalReturnPercentage)})
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'overview' && styles.activeTab]}
          onPress={() => setSelectedTab('overview')}
        >
          <Text style={[styles.tabText, selectedTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'holdings' && styles.activeTab]}
          onPress={() => setSelectedTab('holdings')}
        >
          <Text style={[styles.tabText, selectedTab === 'holdings' && styles.activeTabText]}>
            Holdings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />
        }
      >
        {selectedTab === 'overview' ? (
          <View>
            {/* Allocation Summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Allocation</Text>
              <View style={styles.allocationContainer}>
                {portfolio.holdings.slice(0, 5).map((holding, index) => (
                  <View key={holding.ticker} style={styles.allocationItem}>
                    <View style={styles.allocationHeader}>
                      <Text style={styles.allocationTicker}>{holding.ticker}</Text>
                      <Text style={styles.allocationPercent}>
                        {holding.allocation.toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.allocationBarContainer}>
                      <View
                        style={[
                          styles.allocationBar,
                          {
                            width: `${holding.allocation}%`,
                            backgroundColor:
                              index === 0
                                ? theme.gold
                                : index === 1
                                ? '#d4af37'
                                : index === 2
                                ? '#e5c76b'
                                : index === 3
                                ? '#f0d78c'
                                : '#fae8ad',
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Performance Stats */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Performance</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Day Gain</Text>
                  <Text style={[styles.statValue, { color: theme.green }]}>+$1,245.30</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Total Gain</Text>
                  <Text style={[styles.statValue, { color: theme.green }]}>
                    {formatCurrency(portfolio.totalReturn)}
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Best Performer</Text>
                  <Text style={[styles.statValue, { color: theme.green }]}>NVDA +41.5%</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Holdings</Text>
                  <Text style={styles.statValue}>{portfolio.holdings.length}</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.holdingsContainer}>
            {portfolio.holdings.map((holding) => (
              <TouchableOpacity
                key={holding.ticker}
                style={styles.holdingCard}
                onPress={() => navigation.navigate('StockDetail', { ticker: holding.ticker })}
              >
                <View style={styles.holdingHeader}>
                  <View style={styles.holdingInfo}>
                    <View style={styles.holdingIcon}>
                      <Text style={styles.holdingIconText}>{holding.ticker[0]}</Text>
                    </View>
                    <View>
                      <Text style={styles.holdingTicker}>{holding.ticker}</Text>
                      <Text style={styles.holdingName} numberOfLines={1}>
                        {holding.shares} shares @ {formatCurrency(holding.avgPrice)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.holdingValue}>
                    <Text style={styles.holdingValueText}>
                      {formatCurrency(holding.value)}
                    </Text>
                    <Text
                      style={[
                        styles.holdingReturn,
                        { color: holding.return >= 0 ? theme.green : theme.red },
                      ]}
                    >
                      {formatPercentage(holding.returnPercentage)}
                    </Text>
                  </View>
                </View>
                <View style={styles.holdingFooter}>
                  <Text style={styles.holdingFooterText}>
                    Current: {formatCurrency(holding.currentPrice)}
                  </Text>
                  <Text style={styles.holdingFooterText}>
                    Allocation: {holding.allocation.toFixed(1)}%
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
  totalValueContainer: {
    marginTop: 16,
  },
  totalValue: {
    color: theme.text,
    fontSize: 36,
    fontWeight: 'bold',
  },
  returnContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  returnText: {
    fontSize: 16,
    marginLeft: 6,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.gold,
  },
  tabText: {
    color: theme.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: theme.gold,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  allocationContainer: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  allocationItem: {
    marginBottom: 12,
  },
  allocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  allocationTicker: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  allocationPercent: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  allocationBarContainer: {
    height: 8,
    backgroundColor: theme.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  allocationBar: {
    height: '100%',
    borderRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    width: (screenWidth - 52) / 2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  statValue: {
    color: theme.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  holdingsContainer: {
    padding: 20,
  },
  holdingCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  holdingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  holdingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  holdingIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: `${theme.gold}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  holdingIconText: {
    color: theme.gold,
    fontSize: 18,
    fontWeight: 'bold',
  },
  holdingTicker: {
    color: theme.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  holdingName: {
    color: theme.textSecondary,
    fontSize: 12,
    maxWidth: 150,
  },
  holdingValue: {
    alignItems: 'flex-end',
  },
  holdingValueText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  holdingReturn: {
    fontSize: 14,
    marginTop: 2,
  },
  holdingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  holdingFooterText: {
    color: theme.textSecondary,
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtitle: {
    color: theme.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
});
