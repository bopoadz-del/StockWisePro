import { useState, useEffect } from 'react';

import { Navbar } from './sections/Navbar';
import { Hero } from './sections/Hero';
import { LiveMarketData } from './sections/LiveMarketData';
import { StockScreener } from './sections/StockScreener';
import { ScoringSystem } from './sections/ScoringSystem';
import { InvestorPortfolios } from './sections/InvestorPortfolios';
import { Pricing } from './sections/Pricing';
import { Testimonials } from './sections/Testimonials';
import { FAQ } from './sections/FAQ';
import { CTABanner } from './sections/CTABanner';
import { Footer } from './sections/Footer';
import { LiveTicker } from './components/LiveTicker';
import { StockDetailDrawer } from './components/StockDetailDrawer';
import { Watchlist } from './components/Watchlist';
import { StockComparison } from './components/StockComparison';
import { ExperimentWorkspace } from './components/ExperimentWorkspace';
import { AuthModal } from './components/AuthModal';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { Button } from './components/ui/button';
import { Eye, ArrowRightLeft, BarChart3, User, LogOut } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { analytics } from './lib/analytics';
import { toast } from 'sonner';
import './App.css';

function App() {
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  // Track page views
  useEffect(() => {
    analytics.trackPageView();
  }, []);

  // Set user ID in analytics when authenticated
  useEffect(() => {
    if (user?.id) {
      analytics.setUserId(user.id);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navbar 
        onLoginClick={() => setIsAuthOpen(true)} 
        user={user}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
      />
      
      {/* Floating Action Buttons */}
      <div className="fixed right-4 bottom-4 z-40 flex flex-col gap-2">
        {isAuthenticated && (
          <>
            <Button
              onClick={() => setIsWatchlistOpen(true)}
              className="bg-gold hover:bg-gold-light text-[#0a0a0a] shadow-lg"
            >
              <Eye size={18} className="mr-2" />
              Watchlist
            </Button>
            <Button
              onClick={() => setIsComparisonOpen(true)}
              variant="outline"
              className="bg-[#1f1f1f] border-white/20 text-white hover:bg-white/10"
            >
              <ArrowRightLeft size={18} className="mr-2" />
              Compare
            </Button>
          </>
        )}
        
        {/* Analytics Button (for testing) */}
        <Button
          onClick={() => setIsAnalyticsOpen(true)}
          variant="outline"
          className="bg-purple-500/20 border-purple-500/50 text-purple-400 hover:bg-purple-500/30"
        >
          <BarChart3 size={18} className="mr-2" />
          Analytics
        </Button>

        {/* Auth Button */}
        {!isAuthenticated ? (
          <Button
            onClick={() => setIsAuthOpen(true)}
            variant="outline"
            className="bg-[#1f1f1f] border-white/20 text-white hover:bg-white/10"
          >
            <User size={18} className="mr-2" />
            Sign In
          </Button>
        ) : (
          <Button
            onClick={handleLogout}
            variant="outline"
            className="bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30"
          >
            <LogOut size={18} className="mr-2" />
            Logout
          </Button>
        )}
      </div>

      <main>
        <Hero onCtaClick={() => setIsAuthOpen(true)} />
        <LiveTicker />
        <LiveMarketData />
        <StockScreener 
          onSelectStock={setSelectedStock} 
          isAuthenticated={isAuthenticated}
        />
        
        {/* Experiment Workspace */}
        <section className="py-20 bg-[#141414]">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Formula <span className="text-gradient-gold">Lab</span>
              </h2>
              <p className="text-white/60 max-w-2xl mx-auto">
                Experiment with custom scoring algorithms in real-time. Test different weights, 
                metrics, and formulas to create your perfect investment strategy.
              </p>
            </div>
            <ExperimentWorkspace />
          </div>
        </section>

        <ScoringSystem />
        <InvestorPortfolios isAuthenticated={isAuthenticated} />
        <Pricing />
        <Testimonials />
        <FAQ />
        <CTABanner onCtaClick={() => setIsAuthOpen(true)} />
      </main>
      
      <Footer />

      {/* Modals/Drawers */}
      <StockDetailDrawer
        ticker={selectedStock || ''}
        isOpen={!!selectedStock}
        onClose={() => setSelectedStock(null)}
      />
      
      <Watchlist
        isOpen={isWatchlistOpen}
        onClose={() => setIsWatchlistOpen(false)}
        onSelectStock={setSelectedStock}
      />
      
      <StockComparison
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <AnalyticsDashboard
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
      />
    </div>
  );
}

export default App;
