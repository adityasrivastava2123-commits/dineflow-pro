import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    description: String,

    // Support both legacy field names and new ones
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    discountValue: { type: Number, required: true },
    type: {               // legacy alias for discountType
      type: String,
      enum: ["percentage", "fixed"],
    },
    discount: Number,     // legacy alias for discountValue

    minimumOrder: { type: Number, default: 0 },
    minimumOrderValue: { type: Number, default: 0 }, // legacy alias
    maxDiscount: Number,
    maximumDiscount: Number,  // legacy alias

    // Date range
    expiresAt: Date,
    validFrom: Date,
    validUpto: Date,     // legacy alias for expiresAt

    usageLimit: Number,
    usedCount: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },
    isPublic: { type: Boolean, default: true }, // show on customer-facing offers page

    // Per-user limit
    perUserLimit: { type: Number, default: 0 }, // 0 = unlimited
  },
  {
    timestamps: true,
  }
);

offerSchema.index({ restaurant: 1, isActive: 1 });
offerSchema.index({ code: 1, restaurant: 1 });

/**
 * Virtual: is this coupon currently valid?
 */
offerSchema.virtual("isValid").get(function () {
  const now = new Date();
  const start = this.validFrom || new Date(0);
  const end = this.expiresAt || this.validUpto;
  if (!this.isActive) return false;
  if (now < start) return false;
  if (end && now > end) return false;
  if (this.usageLimit && this.usedCount >= this.usageLimit) return false;
  return true;
});

/**
 * Normalize legacy fields on pre-save
 */
offerSchema.pre("save", function (next) {
  if (this.type && !this.discountType) this.discountType = this.type;
  if (this.discount && !this.discountValue) this.discountValue = this.discount;
  if (this.minimumOrderValue && !this.minimumOrder) this.minimumOrder = this.minimumOrderValue;
  if (this.maximumDiscount && !this.maxDiscount) this.maxDiscount = this.maximumDiscount;
  if (this.validUpto && !this.expiresAt) this.expiresAt = this.validUpto;
  next();
});

export default mongoose.model("Offer", offerSchema);
