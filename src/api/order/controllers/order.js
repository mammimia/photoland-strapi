const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

("use strict");

/**
 * order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async create(ctx) {
    const { cart } = ctx.request.body;
    if (!cart || cart.length === 0) {
      return ctx.badRequest(null, "No cart items");
    }

    const lineItems = await Promise.all(
      cart.map(async (item) => {
        const product = await strapi
          .service("api::product.product")
          .findOne(item.id);
        return {
          price_data: {
            currency: "usd",
            product_data: {
              name: product.title,
            },
            unit_amount: product.price * 100,
          },
          quantity: item.amount,
        };
      })
    );

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${process.env.CLIENT_URL}?success=true`,
        cancel_url: `${process.env.CLIENT_URL}?success=false`,
        line_items: lineItems,
        shipping_address_collection: { allowed_countries: ["US", "CA"] },
        payment_method_types: ["card"],
      });

      await strapi.service("api::order.order").create({
        data: {
          products: cart,
          stripeId: session.id,
        },
      });

      return { stripeSession: session };
    } catch (err) {
      ctx.response.status = 500;
    }
  },
}));
