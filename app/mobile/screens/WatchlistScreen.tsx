import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
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

interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  alertPrice?: number;
}

export default function WatchlistScreen({ navigation }: any) {
  const { isAuthenticated, user } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWatchlist = useCallback(async () => {
    try {
      if (isAuthenticated && user) {
        // Fetch from backend if authenticated
        const token = await AsyncStorage.getItem('auth-token');
        const response = await fetch(`${API_URL}/watchlist`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setWatchlist(data);
        }
      } else {
        // Load from local storage for guests
        const localWatchlist = await AsyncStorage.getItem('guest-watchlist');
        if (localWatchlist) {
          setWatchlist(JSON.parse(localWatchlist));
        }
      }
    } catch (error) {
      console.error('Error fetching watchlist:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWatchlist();
    setRefreshing(false);
  };

  const removeFromWatchlist = async (ticker: string) => {
    try {
      if (isAuthenticated) {
        const token = await AsyncStorage.getItem('auth-token');
        await fetch(`${API_URL}/watchlist/${ticker}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } else {
        // Update local storage
        const updated = watchlist.filter((item) => item.ticker !== ticker);
        await AsyncStorage.setItem('guest-watchlist', JSON.stringify(updated));
      }
      
      setWatchlist((prev) => prev.filter((item) => item.ticker !== ticker));
    } catch (error) {
      Alert.alert('Error', 'Failed to remove from watchlist');
    }
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Watchlist</Text>
        <Text style={styles.subtitle}>
          {watchlist.length} {watchlist.length === 1 ? 'stock' : 'stocks'} tracked
        </Text>
      </View>

      {/* Content */}
      {watchlist.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="star-outline" size={48} color={theme.gold} />
          </View>
          <Text style={styles.emptyTitle}>Your watchlist is empty</Text>
          <Text style={styles.emptySubtitle}>
            Add stocks to track their performance and get alerts
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('Screener')}
          >
            <Text style={styles.emptyButtonText}>Browse Stocks</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />
          }
        >
          {watchlist.map((item) => (
            <View key={item.ticker} style={styles.stockCard}>
              <TouchableOpacity
                style={styles.stockContent}
                onPress={() => navigation.navigate('StockDetail', { ticker: item.ticker })}
              >
                <View style={styles.stockInfo}>
                  <View style={styles.stockIcon}>
                    <Text style={styles.stockIconText}>{item.ticker[0]}</Text>
                  </View>
                  <View>
                    <Text style={styles.stockSymbol}>{item.ticker}</Text>
                    <Text style={styles.stockName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                </View>

                <View style={styles.stockPrice}>
                  <Text style={styles.priceText}>{formatCurrency(item.price)}</Text>
                  <View style={styles.changeContainer}>
                    <Ionicons
                      name={item.change >= 0 ? 'trending-up' : 'trending-down'}
                      size={14}
                      color={item.change >= 0 ? theme.green : theme.red}
                    />
                    <Text
                      style={[
                        styles.changeText,
                        { color: item.change >= 0 ? theme.green : theme.red },
                      ]}
                    >
                      {formatPercentage(item.changesPercentage)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {item.alertPrice && (
                <View style={styles.alertBadge}>
                  <Ionicons name="notifications" size={12} color={theme.gold} />
                  <Text style={styles.alertText}>
                    Alert at {formatCurrency(item.alertPrice)}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.removeButton}
                onPress={() =>
                  Alert.alert(
                    'Remove from Watchlist',
                    `Remove ${item.ticker} from your watchlist?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', onPress: () => removeFromWatchlist(item.ticker), style: 'destructive' },
                    ]
                  )
                }
              >
                <Ionicons name="close-circle" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add Button */}
      {watchlist.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('Screener')}
        >
          <Ionicons name="add" size={28} color={theme.background} />
        </TouchableOpacity>
      )}
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${theme.gold}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: theme.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: theme.gold,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: theme.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stockCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  stockContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stockIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${theme.gold}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stockIconText: {
    color: theme.gold,
    fontSize: 20,
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
    maxWidth: 150,
  },
  stockPrice: {
    alignItems: 'flex-end',
  },
  priceText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  changeText: {
    fontSize: 14,
    marginLeft: 4,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: `${theme.gold}15`,
    borderRadius: 6,
  },
  alertText: {
    color: theme.gold,
    fontSize: 12,
    marginLeft: 6,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.gold,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
