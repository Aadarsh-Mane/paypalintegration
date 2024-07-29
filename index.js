import { google } from "googleapis";
import express from "express";
import axios from "axios";
import admin from "firebase-admin";
import dotenv from "dotenv";
import PayPal from "paypal-rest-sdk";
import { v4 as uuidv4 } from "uuid";

dotenv.config(); // Load environment variables from .env file

const PORT = process.env.PORT || 5000;
// import key from './myschool.json' with { type: "json" };

const app = express();
app.use(express.json()); // Parse JSON-encoded bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.projectid,
    clientEmail: process.env.client_email,

    privateKey: process.env.private_key,
  }),
  // Replace with your Firebase project config
  databaseURL: "https://wallpaper-9dd6b-default-rtdb.firebaseio.com/",
});
const db = admin.firestore(); // Get Firestore instance
PayPal.configure({
  mode: "sandbox", // Change to 'live' for production
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
});

// Endpoint to handle purchase
// Endpoint to handle purchase
app.post("/purchase", async (req, res) => {
  const { wallpaperId } = req.body;

  const createPaymentJson = {
    intent: "sale",
    payer: {
      payment_method: "paypal",
    },
    redirect_urls: {
      return_url: `http://localhost:4000/success?wallpaperId=${wallpaperId}`,
      cancel_url: `http://localhost:4000/cancel?wallpaperId=${wallpaperId}`,
    },
    transactions: [
      {
        item_list: {
          items: [
            {
              name: "Wallpaper Purchase",
              sku: "001",
              price: "10.00",
              currency: "USD",
              quantity: 1,
            },
          ],
        },
        amount: {
          currency: "USD",
          total: "10.00",
        },
        description: "Purchase premium wallpaper.",
      },
    ],
  };

  PayPal.payment.create(createPaymentJson, function (error, payment) {
    if (error) {
      console.log(error.response);
      res.status(500).send("Error creating PayPal payment");
    } else {
      for (let i = 0; i < payment.links.length; i++) {
        if (payment.links[i].rel === "approval_url") {
          res.send({ forwardLink: payment.links[i].href });
        }
      }
    }
  });
});

// Endpoint to handle PayPal payment success
app.get("/success", async (req, res) => {
  const payerId = req.query.PayerID;
  const paymentId = req.query.paymentId;
  const wallpaperId = req.query.wallpaperId;

  const executePaymentJson = {
    payer_id: payerId,
    transactions: [
      {
        amount: {
          currency: "USD",
          total: "10.00",
        },
      },
    ],
  };

  PayPal.payment.execute(
    paymentId,
    executePaymentJson,
    async function (error, payment) {
      if (error) {
        console.log(error.response);
        res.status(500).send("Payment execution failed");
      } else {
        // Generate access token
        const accessToken = uuidv4();

        // Store purchase information in Firestore
        await db.collection("purchases").add({
          wallpaperId: wallpaperId,
          accessToken: accessToken,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Send access token to the client
        res.send({ accessToken: accessToken });
      }
    }
  );
});

// Endpoint to handle PayPal payment cancellation
app.get("/cancel", (req, res) => {
  res.send("Payment was cancelled.");
});

// checking port on local server

// checking port on local server
app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
