import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, RotateCcw, ChevronRight, Clock, CheckCircle2 } from 'lucide-react';
import { ordersAPI } from '../../services/api';
import { useCart } from '../../context/CartContext';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-blue-100 text-blue-700',
  preparing: 'bg-orange-100 text-orange-700',
  ready: 'bg-green-100 text-green-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function CustomerOrderHistory() {
  const navigate = useNavigate();
  const { addItem, setRestaurant } = useCart();
  const [phone, setPhone] = useState('');
  const [restaurantSlug, setRestaurantSlug] = useState('');
  const [orders, setOrders] = useState([]);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reordering, setReordering] = useState(null);

  const handleSearch = async () => {
    if (phone.length < 10) { toast.error('Enter a valid phone number'); return; }
    setLoading(true);
    try {
      const res = await ordersAPI.getCustomerHistory(phone, restaurantSlug || undefined);
      const { orders: fetchedOrders, customer } = res.data;
      setOrders(fetchedOrders || []);
      setCustomerInfo(customer || null);
      setSearched(true);
      if (customer?.name) {
        toast.success(`Welcome back, ${customer.name}! 👋`);
      }
    } catch { toast.error('Failed to fetch history'); } finally { setLoading(false); }
  };

  // ── One-Tap Reorder ──────────────────────────────────────────────────────
  const handleReorder = async (order) => {
    setReordering(order._id);
    try {
      // Set restaurant context in cart
      if (order.restaurant?._id) setRestaurant(order.restaurant._id);

      let addedCount = 0;
      for (const item of order.items) {
        if (!item.menuItem) continue;
        addItem({
          menuItemId: item.menuItem._id || item.menuItem,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          addons: item.addons || [],
          specialInstructions: item.specialInstructions || '',
          isVeg: item.isVeg,
        });
        addedCount++;
      }

      toast.success(`${addedCount} items added to cart! 🛒`);

      // Navigate to restaurant menu if we have slug
      const slug = order.restaurant?.slug;
      const table = restaurantSlug || undefined;
      if (slug) {
        navigate(`/restaurant/${slug}${table ? `?table=${table}` : ''}`);
      }
    } catch {
      toast.error('Failed to reorder');
    } finally {
      setReordering(null);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-stone-950 px-4 py-8 text-center">
        <h1 className="font-display font-black text-2xl text-white mb-1">Order History</h1>
        <p className="text-stone-400 text-sm">Enter your phone number to see past orders</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Search Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">Phone Number</label>
            <input
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              type="tel"
              placeholder="Enter your 10-digit phone number"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              maxLength={10}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">Restaurant (optional)</label>
            <input
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              placeholder="Restaurant slug e.g. spice-garden"
              value={restaurantSlug}
              onChange={e => setRestaurantSlug(e.target.value)}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {loading
              ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              : <><Search className="w-4 h-4" />Find My Orders</>
            }
          </button>
        </div>

        {/* Returning customer greeting */}
        {customerInfo?.name && (
          <div className="bg-gradient-to-r from-brand-600 to-brand-500 rounded-2xl p-4 text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-lg font-bold">
              {customerInfo.name[0].toUpperCase()}
            </div>
            <div>
              <div className="font-bold">Welcome back, {customerInfo.name}! 👋</div>
              <div className="text-xs text-brand-100">{orders.length} past order{orders.length !== 1 ? 's' : ''} found</div>
            </div>
          </div>
        )}

        {/* Orders List */}
        {searched && (
          orders.length > 0 ? (
            <div className="space-y-3">
              {orders.map(order => (
                <div key={order._id} className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
                  {/* Order header */}
                  <div className="px-4 py-3 flex items-center justify-between border-b border-stone-50">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-stone-100 rounded-lg flex items-center justify-center font-bold text-stone-600 text-xs">
                        {order.tableNumber || '—'}
                      </div>
                      <div>
                        <div className="font-semibold text-stone-900 text-sm">#{order.orderNumber}</div>
                        <div className="flex items-center gap-1 text-xs text-stone-400">
                          <Clock className="w-3 h-3" />
                          {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-stone-900 text-sm">₹{order.totalAmount?.toFixed(0)}</div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] || 'bg-stone-100 text-stone-600'}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  {/* Items preview */}
                  <div className="px-4 py-2 text-xs text-stone-500">
                    {order.items.slice(0, 3).map((item, i) => (
                      <span key={i}>{item.name} ×{item.quantity}{i < Math.min(order.items.length, 3) - 1 ? ', ' : ''}</span>
                    ))}
                    {order.items.length > 3 && <span className="text-stone-400"> +{order.items.length - 3} more</span>}
                  </div>

                  {/* Actions */}
                  <div className="px-4 pb-3 flex items-center gap-2">
                    {/* One-tap Reorder */}
                    <button
                      onClick={() => handleReorder(order)}
                      disabled={reordering === order._id}
                      className="flex-1 py-2 bg-brand-50 hover:bg-brand-100 disabled:opacity-50 text-brand-700 font-semibold rounded-xl text-sm flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {reordering === order._id
                        ? <div className="w-3.5 h-3.5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                        : <RotateCcw className="w-3.5 h-3.5" />
                      }
                      Reorder
                    </button>

                    {/* Track order */}
                    <Link
                      to={`/order/${order._id}`}
                      className="flex-1 py-2 bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold rounded-xl text-sm flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Track
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-stone-400">
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-stone-300" />
              <div className="font-semibold text-stone-600">No orders found</div>
              <div className="text-sm mt-1">No orders found for {phone}</div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
