const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// const uri =
//   "mongodb+srv://contest-hub:DjFjdKYgJV5PcNR4@cluster0.zneri.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("Contest_Hub");
    const usersCollection = database.collection("users");
    const contestsCollection = database.collection("contests");
    const paymentsCollection = database.collection("payments");

    // get all user
    app.get("/users", async (req, res) => {
      try {
        const result = await usersCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    //   user role get
    app.get("/users/:email/role", async (req, res) => {
      try {
        const email = req.params.email;
        //   console.log(email)
        const query = { email };
        const result = await usersCollection.findOne(query);
        //   console.log(result)
        res.send({ role: result?.role || "user" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // get one user
    app.get("/users/one", async (req, res) => {
      try {
        const email = req.query.email;
        const query = {};

        if (email) {
          query.email = email;
        }

        const result = await usersCollection.findOne(query);
        res.send(result);
        // console.log(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // update user info
    app.patch("/users/:id/info", async (req, res) => {
      try {
        const id = req.params.id;

        // const updatedInfo = req.body;
        // console.log(updatedInfo);

        const filter = { _id: new ObjectId(id) };
        const updatedDoc = { $set: req.body };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // update user role
    app.patch("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;

        // console.log(id, req.body);

        const filter = { _id: new ObjectId(id) };
        const updatedDoc = { $set: req.body };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    //   user created
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        user.role = "user";
        user.createdAt = new Date();
        user.status = "Active";

        const email = user.email;

        const existUser = await usersCollection.findOne({ email });
        if (existUser) {
          return res.send("User Already Exist");
        }

        const result = await usersCollection.insertOne(req.body);
        res.status(201).send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // PAYMENTS RELATED API'S
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      // console.log(paymentInfo);
      const amount = parseInt(paymentInfo.contestPrice) * 100;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "USD",
              unit_amount: amount,
              product_data: {
                name: paymentInfo?.contestName,
                description: paymentInfo?.contestDescription,
                images: [paymentInfo?.contestImage],
              },
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo?.participant?.email,
        mode: "payment",
        metadata: {
          contestId: paymentInfo.contestId,
          customer: paymentInfo.participant.email,
          deadline: paymentInfo.contestDeadline,
          name: paymentInfo?.contestName,
        },
        success_url: `${process.env.SITE_DOMAIN}/contest/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/contest/payment-cancelled`,
      });
      res.send({ url: session.url });
    });

    // post payment
    app.post("/payment-success", async (req, res) => {
      try {
        const { sessionId } = req.body;

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        // console.log(session);

        const transactionId = session.payment_intent;
        // const contestId = session.metadata.contestId;
        const query = { transactionId };

        // console.log(session);

        const paymentExist = await paymentsCollection.findOne(query);
        if (paymentExist) {
          return res.send({
            message: "already exists",
            transactionId,
            amount: session.amount_total / 100,
            contestId: session.metadata.contestId,
          });
        }

        const payment = {
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          amount: session.amount_total / 100,
          currency: session.currency,
          contestParticipantEmail: session.customer_email,
          contestId: session.metadata.contestId,
          contestDeadline: session.metadata.deadline,
          contestName: session.metadata.name,
          submitted: null,
          paidAt: new Date(),
        };
        // console.log(payment);

        if (session.payment_status === "paid") {
          const resultPayment = await paymentsCollection.insertOne(payment);

          // console.log(resultPayment);
          res.send({
            success: true,
            paymentInfo: resultPayment,
            amount: session.amount_total / 100,
            transactionId: session.payment_intent,
            contestId: session.metadata.contestId,
          });
        }

        // participants added
        if (session.payment_status === "paid") {
          const contestId = session.metadata.contestId;
          const query = { _id: new ObjectId(contestId) };

          const participantsResult = await contestsCollection.findOne(query, {
            projection: { participants: 1 },
          });

          const { participants } = participantsResult;

          // Default 0 if undefined / null / ""
          const current = parseInt(participants) || 0;

          const totalParticipants = current + 1;

          await contestsCollection.updateOne(query, {
            $set: { participants: totalParticipants },
          });

          console.log("Updated participants:", totalParticipants);
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // payment status
    app.get("/payments/payment-status", async (req, res) => {
      try {
        const { contestId, contestParticipantEmail } = req.query;
        // console.log(contestId, contestParticipantEmail);
        const query = { contestId, contestParticipantEmail };
        // console.log(query)
        const result = await paymentsCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // participated contests
    app.get("/payments/all-contests", async (req, res) => {
      try {
        const contestParticipantEmail = req.query.contestParticipantEmail;
        const query = { contestParticipantEmail };
        // if (contestParticipantEmail) {
        //   query.contestParticipantEmail = contestParticipantEmail;
        // }
        const sortFields = { contestDeadline: 1 };

        const result = await paymentsCollection
          .find(query)
          .sort(sortFields)
          .toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // payments task-submitted
    app.get("/payments/task-submitted", async (req, res) => {
      try {
        const { contestId } = req.query;
        // console.log(query)
        const submitted = true;

        const query = { contestId, submitted };
        // console.log(query);
        const result = await paymentsCollection.find(query).toArray();
        // console.log(result, query);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // submitted true and task submitted
    app.patch("/payments/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { contestParticipantEmail } = req.query;
        const filter = { _id: new ObjectId(id), contestParticipantEmail };

        const updatedDoc = {
          $set: req.body,
        };
        // console.log(filter, updatedDoc, contestParticipantEmail);
        const result = await paymentsCollection.updateOne(filter, updatedDoc);
        res.send(result);
        // console.log(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // contest related api's

    // get all by admin
    app.get("/contests", async (req, res) => {
      try {
        const result = await contestsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // get all contests by creator email
    app.get("/contests/creator", async (req, res) => {
      try {
        const email = req.query.email;
        const query = {};
        // console.log(email);
        if (!email) {
          return res.send({ message: "creator email not found" });
        } else {
          query.email = email;
        }

        const result = await contestsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // get all contest for all users
    app.get("/contests/all-users", async (req, res) => {
      try {
        const status = req.query.status;
        // console.log(status);
        const query = {};

        if (status) {
          query.status = status;
        }

        const result = await contestsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // get popular contests
    app.get("/contests/popular-contests", async (req, res) => {
      try {
        const status = req.query.status;
        // console.log(status);
        const sortFields = { participants: -1 };
        const limitNum = 6;
        const result = await contestsCollection
          .find({ status })
          .sort(sortFields)
          .limit(limitNum)
          .toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });
    // get one contest
    app.get("/contests/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await contestsCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // created contest
    app.post("/contests", async (req, res) => {
      try {
        const contest = req.body;
        // console.log(contest);
        contest.status = "Pending";
        contest.createdAt = new Date();
        const result = await contestsCollection.insertOne(contest);
        res.status(201).send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // update contest role for admin
    app.patch("/contests/:id/admin", async (req, res) => {
      try {
        const status = req.body.newStatus;
        // console.log(status)

        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = { $set: { status } };
        // console.log('check',filter,req.body)
        const result = await contestsCollection.updateOne(filter, updatedDoc);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // contest winner updated by creator
    app.patch("/contests/:id/creator", async (req, res) => {
      try {
        const win = req.body;
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        // console.log(filter, i);
        const updatedDoc = {
          $set: {
            winner: win,
          },
        };
        const result = await contestsCollection.updateOne(filter, updatedDoc);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // update contest for creator
    app.patch("/contests/:id/update", async (req, res) => {
      try {
        const id = req.params.id;

        // console.log(req.body);
        const contest = req.body;

        const contestInfo = {
          deadline: contest.deadline,
          description: contest.description,
          image: contest.image,
          instructions: contest.instructions,
          name: contest.name,
          price: contest.price,
          prizeMoney: contest.prizeMoney,
          type: contest.type,
        };
        // console.log(updatedDoc);

        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: contestInfo,
        };
        const result = await contestsCollection.updateOne(filter, updatedDoc);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // deleted contest
    app.delete("/contests/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await contestsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Contest Hub Server is Running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
