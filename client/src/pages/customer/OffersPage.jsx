import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Tag, Gift, Percent, Clock, ChevronRight, Copy, CheckCircle2, Flame } from 'lucide-react';
import { couponsAPI, menuAPI } from '../../services/api';
import toast from 'react-hot-toast';

function CouponCard({ coupon, onCopy }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(coupon.code).then(() => {
      setCopied(true);
      onCopy(coupon.code);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
  const expiresIn = coupon.expiresAt
    ? Math.ceil((new Date(coupon.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className={`bg-white rounded-2xl border-2 ${isExpired ? 'border-stone-200 opacity-60' : 'border-dashed border-brand-300'} overflow-hidden shadow-sm`}>
      {/* Top stripe */}
      <div className={`h-1.5 ${isExpired ? 'bg-stone-300' : 'bg-gradient-to-r from-brand-500 to-orange-400'}`} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {coupon.discountType === 'percentage' ? (
                <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center">
                  <Percent className="w-4 h-4 text-brand-600" />
                </div>
              ) : (
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Gift className="w-4 h-4 text-green-600" />
                </div>
              )}
              <span className="font-display font-black text-lg text-stone-900">
                {coupon.discountType === 'percentage'
                  ? `${coupon.discountValue}% OFF`
                  : `₹${coupon.discountValue} OFF`
                }
              </span>
              {coupon.maxDiscount && coupon.discountType === 'percentage' && (
                <span className="text-xs text-stone-400">up to ₹{coupon.maxDiscount}</span>
              )}
            </div>

            <div className="text-sm text-stone-600 mb-2">
              {coupon.description || `Use code to save ${coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}`}
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-stone-400">
              {coupon.minimumOrder > 0 && (
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Min. order ₹{coupon.minimumOrder}
                </span>
              )}
              {expiresIn !== null && expiresIn > 0 && (
                <span className="flex items-center gap-1 text-amber-500">
                  <Clock className="w-3 h-3" /> Expires in {expiresIn}d
                </span>
              )}
              {isExpired && <span className="text-red-400 font-semibold">Expired</span>}
            </div>
          </div>

          {/* Coupon code + copy */}
          <div className="flex flex-col items-end gap-2">
            <div className="font-mono font-bold text-sm bg-stone-100 px-3 py-1.5 rounded-lg text-stone-800 tracking-wider">
              {coupon.code}
            </div>
            <button
              onClick={handleCopy}
              disabled={isExpired}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                copied
                  ? 'bg-green-100 text-green-700'
                  : isExpired
                  ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                  : 'bg-brand-50 hover:bg-brand-100 text-brand-700'
              }`}
            >
              {copied ? <><CheckCircle2 className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>
        </div>
      </div>

      {/* Notch style */}
      <div className="flex items-center px-4 py-2 bg-stone-50 border-t border-dashed border-stone-200">
        <div className="-ml-8 w-6 h-6 rounded-full bg-stone-50 border border-stone-200" />
        <div className="flex-1 border-t border-dashed border-stone-300 mx-2" />
        <div className="-mr-8 w-6 h-6 rounded-full bg-stone-50 border border-stone-200" />
      </div>
    </div>
  );
}

export default function OffersPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table');

  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState(null);
  const [copiedCode, setCopiedCode] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [menuRes] = await Promise.all([
          menuAPI.getMenu(slug),
        ]);
        setRestaurant(menuRes.data.restaurant);

        // Fetch public coupons for this restaurant
        try {
          const restaurantId = menuRes.data.restaurant.id;
          const couponsRes = await couponsAPI.getPublic(restaurantId);
          setCoupons(couponsRes.data?.coupons || []);
        } catch {
          // Coupons endpoint may require auth — show demo coupons
          setCoupons([]);
        }
      } catch {
        toast.error('Failed to load offers');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [slug]);

  const handleCopy = (code) => {
    setCopiedCode(code);
    toast.success(`Coupon "${code}" copied! Apply at checkout.`, { icon: '🎉' });
  };

  const filteredCoupons = coupons.filter(c => {
    if (activeFilter === 'active') return !c.expiresAt || new Date(c.expiresAt) > new Date();
    if (activeFilter === 'expired') return c.expiresAt && new Date(c.expiresAt) <= new Date();
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-stone-950 to-brand-950 px-4 py-10 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-4 text-6xl">🎁</div>
          <div className="absolute top-8 right-8 text-5xl">🏷️</div>
          <div className="absolute bottom-4 left-1/3 text-4xl">💸</div>
        </div>
        <div className="relative">
          <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Gift className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display font-black text-2xl text-white mb-1">Offers & Deals</h1>
          <p className="text-stone-400 text-sm">{restaurant?.name} — exclusive discounts for you</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'all', label: 'All Offers' },
            { key: 'active', label: 'Active' },
            { key: 'expired', label: 'Expired' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                activeFilter === f.key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white text-stone-600 border border-stone-200 hover:border-brand-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Copied banner */}
        {copiedCode && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-green-800">"{copiedCode}"</span>
              <span className="text-green-600"> copied! Apply it at checkout to save.</span>
            </div>
          </div>
        )}

        {/* Coupons */}
        {filteredCoupons.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-stone-500 mb-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <span>{filteredCoupons.length} offer{filteredCoupons.length !== 1 ? 's' : ''} available</span>
            </div>
            {filteredCoupons.map(coupon => (
              <CouponCard key={coupon._id || coupon.code} coupon={coupon} onCopy={handleCopy} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-stone-400">
            <Tag className="w-12 h-12 mx-auto mb-3 text-stone-300" />
            <div className="font-semibold text-stone-600 mb-1">No offers right now</div>
            <p className="text-sm">Check back later for exciting deals from {restaurant?.name}!</p>
          </div>
        )}

        {/* CTA back to menu */}
        <div className="mt-8">
          <Link
            to={`/restaurant/${slug}${tableNumber ? `?table=${tableNumber}` : ''}`}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-2xl transition-colors shadow-sm"
          >
            Browse Menu
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
